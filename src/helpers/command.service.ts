import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';

@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name);

  async executeCommand(command: string): Promise<string> {
    this.logger.debug(`Executing command :${command}`);
    return new Promise<string>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`Error executing command :${command}`, error);
          reject(error);
          return;
        }
        if (stderr) {
          this.logger.error(`Error executing command :${command}`, stderr);
          reject(stderr);
          return;
        }
        resolve(stdout);
      });
    });
  }
}
