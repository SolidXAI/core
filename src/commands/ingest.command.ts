import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { IngestMetadataService } from 'src/services/genai/ingest-metadata.service';

interface IngestCommandOptions {
  module?: string;
  // seeder?: string;
}

@Command({ name: 'ingest', description: 'Ingests solid metadata json for all modules deployed in the consuming project' })
export class IngestCommand extends CommandRunner {
  private readonly logger = new Logger(IngestCommand.name);

  constructor(
    private readonly solidRegistry: SolidRegistry,
    private readonly ingestMetadataService: IngestMetadataService,
  ) {
    super();
  }

  async run(passedParam: string[], options?: IngestCommandOptions): Promise<void> {
    this.logger.log(`Running the solid ingest for module ${options.module} at ${new Date()}`);
    await this.ingestMetadataService.ingest();
  }

  @Option({
    flags: '-m, --module [module name]',
    description: 'The seeder to run.',
    required: false,
    defaultValue: ''
  })
  parseString(val: string): string {
    return val;
  }
}
