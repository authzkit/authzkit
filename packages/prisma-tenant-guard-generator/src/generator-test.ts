import { generatorHandler } from '@prisma/generator-helper';
import type { GeneratorOptions } from '@prisma/generator-helper';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const generate = async (options: GeneratorOptions) => {
  console.log('✔ Test generator completed successfully');
};

generatorHandler({
  onManifest: () => ({
    defaultOutput: '../.prisma/tenant-guard',
    prettyName: 'AuthzKit Test Generator',
  }),
  onGenerate: generate,
});