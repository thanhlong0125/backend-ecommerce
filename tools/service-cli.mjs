import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const servicesRoot = path.join(root, 'apps', 'services');
const envFiles = ['.env.example', '.env.local'];
const reservedNames = new Set(['gateway', 'directus-client']);

function assertSlug(slug) {
  if (!/^[a-z][a-z0-9-]*$/.test(slug) || reservedNames.has(slug)) {
    throw new Error(
      'Service name must be lowercase kebab-case (for example: user or email-service).'
    );
  }
}

function portVariable(slug) {
  return `${slug.replace(/-/g, '_').toUpperCase()}_PORT`;
}

async function readOptional(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function getNextPort() {
  let maxPort = 3099;
  for (const filename of envFiles) {
    const contents = await readOptional(path.join(root, filename));
    if (!contents) continue;
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^[A-Z][A-Z0-9_]*_PORT=(\d+)$/);
      if (match) {
        const port = Number(match[1]);
        if (port >= 3000 && port <= 3999) maxPort = Math.max(maxPort, port);
      }
    }
  }
  return maxPort + 1;
}

async function syncPortVariable(slug, port, remove = false) {
  const variable = portVariable(slug);
  for (const filename of envFiles) {
    const file = path.join(root, filename);
    const contents = await readOptional(file);
    if (contents === null && filename === '.env.local') continue;
    const lines = (contents ?? '').split(/\r?\n/);
    const filtered = lines.filter((line) => !line.startsWith(`${variable}=`));

    if (!remove && filename === '.env.example') {
      filtered.push(`${variable}=${port}`);
    } else if (!remove && filename === '.env.local' && contents !== null) {
      filtered.push(`${variable}=${port}`);
    }

    while (filtered.length && filtered[filtered.length - 1] === '') filtered.pop();
    await writeFile(file, `${filtered.join('\n')}\n`, 'utf8');
  }
}

async function updateProjectScripts(slug, remove = false) {
  const packagePath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

  for (const scriptName of ['start:local', 'build']) {
    const script = packageJson.scripts[scriptName];
    const match = script.match(/--projects=([a-z0-9,-]+)/);
    if (!match) {
      throw new Error(`Could not find Nx project list in ${scriptName}.`);
    }
    const projects = new Set(match[1].split(',').filter(Boolean));
    if (remove) projects.delete(slug);
    else projects.add(slug);
    const updatedScript = script.replace(
      match[0],
      `--projects=${[...projects].join(',')}`
    );
    const parallel = updatedScript.match(/--parallel=\d+/);
    packageJson.scripts[scriptName] = parallel
      ? updatedScript.replace(parallel[0], `--parallel=${projects.size}`)
      : `${updatedScript} --parallel=${projects.size}`;
  }

  const typecheck = packageJson.scripts.typecheck;
  const typecheckCommand = `pnpm exec tsc --noEmit -p apps/services/${slug}/tsconfig.app.json`;
  if (remove) {
    packageJson.scripts.typecheck = typecheck
      .split(' && ')
      .filter((command) => command !== typecheckCommand)
      .join(' && ');
  } else if (!typecheck.includes(typecheckCommand)) {
    packageJson.scripts.typecheck = `${typecheck} && ${typecheckCommand}`;
  }

  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function serviceFiles(slug, portName) {
  const appName = slug
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  const servicePropertyName = appName[0].toLowerCase() + appName.slice(1);
  const project = {
    name: slug,
    $schema: '../../../node_modules/nx/schemas/project-schema.json',
    sourceRoot: `apps/services/${slug}/src`,
    projectType: 'application',
    targets: {
      build: {
        executor: '@nx/webpack:webpack',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          target: 'node',
          compiler: 'tsc',
          outputPath: `dist/apps/services/${slug}`,
          main: `apps/services/${slug}/src/main.ts`,
          tsConfig: `apps/services/${slug}/tsconfig.app.json`,
          assets: [`apps/services/${slug}/src/bootstraps`],
          webpackConfig: `apps/services/${slug}/webpack.config.js`,
          generatePackageJson: true,
        },
        configurations: { development: {}, production: { optimization: true } },
      },
      serve: {
        executor: '@nx/js:node',
        defaultConfiguration: 'development',
        dependsOn: ['build'],
        options: { buildTarget: `${slug}:build` },
        configurations: {
          development: {
            buildTarget: `${slug}:build:development`,
            runtimeArgs: ['--env-file=.env.local'],
          },
          production: { buildTarget: `${slug}:build:production` },
        },
      },
    },
  };

  return new Map([
    ['project.json', `${JSON.stringify(project, null, 2)}\n`],
    [
      'tsconfig.json',
      JSON.stringify(
        {
          extends: '../../../tsconfig.base.json',
          compilerOptions: {
            module: 'commonjs',
            forceConsistentCasingInFileNames: true,
            strict: true,
            noImplicitOverride: true,
            noPropertyAccessFromIndexSignature: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
          },
          files: [],
          include: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        null,
        2
      ) + '\n',
    ],
    [
      'tsconfig.app.json',
      JSON.stringify(
        {
          extends: './tsconfig.json',
          compilerOptions: {
            outDir: '../../../dist/out-tsc',
            module: 'commonjs',
            types: ['node'],
            emitDecoratorMetadata: true,
            target: 'es2021',
          },
          exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
          include: ['src/**/*.ts'],
        },
        null,
        2
      ) + '\n',
    ],
    [
      'webpack.config.js',
      "const { composePlugins, withNx } = require('@nx/webpack');\n\nmodule.exports = composePlugins(withNx(), (config) => config);\n",
    ],
    [
      'src/main.ts',
      `import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';
import { loadBootstrap } from '../../../shared/bootstrap';
import { ServiceRegistry } from '../../../shared/service-registry';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const config = loadBootstrap('${slug}', join(__dirname, 'bootstraps'));
  const app = await NestFactory.create(AppModule.register(config));
  app.setGlobalPrefix(config.app.prefix);
  app.enableShutdownHooks();

  await app.listen(config.app.port, '0.0.0.0');
  Logger.log(
    \`${appName} is listening at http://localhost:\${config.app.port}/\${config.app.prefix}; health: http://localhost:\${config.app.port}/\${config.app.prefix}/health\`,
    'Bootstrap'
  );

  try {
    await app.get(ServiceRegistry).register();
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('${appName} startup failed', error);
  process.exitCode = 1;
});
`,
    ],
    [
      'src/app/app.module.ts',
      `import { DynamicModule, Module } from '@nestjs/common';
import { APP_BOOTSTRAP, AppBootstrap } from '../../../../shared/bootstrap';
import { ServiceRegistry } from '../../../../shared/service-registry';
import { HealthController } from './health.controller';
import { ${appName}Controller } from './${slug}.controller';
import { ${appName}Service } from './${slug}.service';

@Module({})
export class AppModule {
  static register(config: AppBootstrap): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ${appName}Controller],
      providers: [
        { provide: APP_BOOTSTRAP, useValue: config },
        ${appName}Service,
        ServiceRegistry,
      ],
    };
  }
}
`,
    ],
    [
      'src/app/health.controller.ts',
      `import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
`,
    ],
    [
      `src/app/${slug}.controller.ts`,
      `import { Controller, Get } from '@nestjs/common';
import { ${appName}Service } from './${slug}.service';

@Controller('${slug}')
export class ${appName}Controller {
  constructor(private readonly ${servicePropertyName}Service: ${appName}Service) {}

  @Get()
  getStatus() {
    return this.${servicePropertyName}Service.getStatus();
  }
}
`,
    ],
    [
      `src/app/${slug}.service.ts`,
      `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${appName}Service {
  getStatus() {
    return { service: '${slug}', status: 'ok' };
  }
}
`,
    ],
    [
      'src/bootstraps/bootstrap-development.yaml',
      `app:
  name: \${APP_NAME}
  prefix: \${APP_PREFIX}
  port: \${${portName}}

service:
  name: \${APP_NAME}-${slug}
  advertiseHost: \${SERVICE_ADVERTISE_HOST}

consul:
  url: \${CONSUL_URL}
`,
    ],
    [
      'src/bootstraps/bootstrap-production.yaml',
      `app:
  name: \${APP_NAME}
  prefix: \${APP_PREFIX}
  port: \${${portName}}

service:
  name: \${APP_NAME}-${slug}
  advertiseHost: \${SERVICE_ADVERTISE_HOST}

consul:
  url: \${CONSUL_URL}
`,
    ],
    ['src/assets/.gitkeep', ''],
  ]);
}

async function createService(slug, requestedPort) {
  assertSlug(slug);
  const serviceDirectory = path.join(servicesRoot, slug);
  try {
    await access(serviceDirectory);
    throw new Error(`Service "${slug}" already exists.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const port = requestedPort === undefined ? await getNextPort() : Number(requestedPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }
  const portName = portVariable(slug);

  for (const filename of envFiles) {
    const content = await readOptional(path.join(root, filename));
    const portLines =
      content?.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*_PORT=\d+$/.test(line)) ?? [];
    for (const line of portLines) {
      const [name, value] = line.split('=');
      if (name === portName && Number(value) !== port) {
        throw new Error(`${portName} already has a different value in ${filename}.`);
      }
      if (name !== portName && Number(value) === port) {
        throw new Error(`Port ${port} is already assigned to ${name} in ${filename}.`);
      }
    }
  }

  await mkdir(serviceDirectory, { recursive: true });
  for (const [relativePath, contents] of serviceFiles(slug, portName)) {
    const target = path.join(serviceDirectory, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  }

  await syncPortVariable(slug, port);
  await updateProjectScripts(slug);
  console.log(`Created service "${slug}" at ${path.relative(root, serviceDirectory)}.`);
  console.log(
    `Gateway route: /api/${slug}/* → Consul service \${APP_NAME}-${slug}`
  );
  console.log(`Local port: ${port}. Start with: pnpm exec nx serve ${slug}`);
}

async function deleteService(slug) {
  assertSlug(slug);
  const serviceDirectory = path.resolve(servicesRoot, slug);
  if (path.dirname(serviceDirectory) !== servicesRoot) {
    throw new Error('Refusing to delete a path outside apps/services.');
  }
  try {
    await access(path.join(serviceDirectory, 'project.json'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Service "${slug}" was not found under apps/services.`);
    }
    throw error;
  }

  console.warn(
    `Warning: deleting "${slug}" removes its source. Gateway route /api/${slug}/* will stop working; stop the service process first.`
  );
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let confirmation;
  try {
    confirmation = await prompt.question(`Type "${slug}" to confirm deletion: `);
  } finally {
    prompt.close();
  }
  if (confirmation !== slug) {
    console.log('Deletion cancelled.');
    return;
  }

  await rm(serviceDirectory, { recursive: true });
  await syncPortVariable(slug, undefined, true);
  await updateProjectScripts(slug, true);
  console.log(`Deleted service "${slug}".`);
}

async function main() {
  const [command, slug, ...options] = process.argv.slice(2);
  if (command === 'create' && slug) {
    if (
      options.length !== 0 &&
      !(options.length === 2 && options[0] === '--port' && options[1])
    ) {
      throw new Error('Unsupported create option. Use --port <port> if needed.');
    }
    const port = options.length === 2 ? options[1] : undefined;
    return createService(slug, port);
  }
  if (command === 'delete' && slug && options.length === 0) {
    return deleteService(slug);
  }
  console.log(
    'Usage:\n  pnpm run service -- create <name> [--port <port>]\n  pnpm run service -- delete <name>'
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
