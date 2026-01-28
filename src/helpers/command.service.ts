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
   * Escape an argument for Windows CMD shell
   * Wraps in double quotes and escapes internal double quotes
   */
  private escapeArgForWindows(arg: string): string {
    // If arg contains special characters, wrap in double quotes
    // and escape internal double quotes with backslash
    if (/[{}\s"^&|<>]/.test(arg)) {
      // Escape internal double quotes with backslash for CMD
      const escaped = arg.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return arg;
  }

  /**
   * Execute a command with arguments array (cross-platform compatible)
   */
  async executeCommandWithArgs(commandWithArgs: CommandWithArgs): Promise<string> {
    const { command, args } = commandWithArgs;
    this.logger.debug(`Executing command: ${command} ${args.join(' ')}`);

    return new Promise<string>((resolve, reject) => {
      const isWindows = process.platform === 'win32';

      // On Windows with shell: true, we need to escape args containing special characters
      const spawnArgs = isWindows
        ? args.map(arg => this.escapeArgForWindows(arg))
        : args;

      const child = spawn(command, spawnArgs, {
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
