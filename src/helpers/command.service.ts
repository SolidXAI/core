import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';

export type CommandWithArgs = {
  command: string;
  args: string[];
};

@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name);

  /**
   * Execute a command with arguments array (cross-platform compatible)
   */
  async executeCommandWithArgs(commandWithArgs: CommandWithArgs): Promise<string> {
    const { command, args } = commandWithArgs;
    this.logger.debug(`Executing command: ${command} ${args.join(' ')}`);

    return new Promise<string>((resolve, reject) => {
      const isWindows = process.platform === 'win32';

      // On Windows, we need to use cmd /c for commands that might be .cmd files (like npm scripts)
      const spawnCommand = isWindows ? command : command;
      const spawnArgs = args;

      const child = spawn(spawnCommand, spawnArgs, {
        shell: isWindows, // Use shell on Windows to handle .cmd files
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        this.logger.error(`Error executing command: ${command}`, error);
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`Command failed with code ${code}: ${command}`, stderr);
          reject(new Error(stderr || `Command failed with exit code ${code}`));
          return;
        }
        resolve(stdout);
      });
    });
  }
}
