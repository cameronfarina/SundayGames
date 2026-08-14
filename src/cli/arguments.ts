export class CliArguments {
  readonly command: string | undefined;
  readonly values: string[];

  constructor(arguments_: readonly string[]) {
    this.command = arguments_[0];
    this.values = arguments_.slice(1);
  }

  has(name: string): boolean {
    return this.values.includes(name);
  }

  option(name: string): string | undefined {
    const option = this.values.find(argument => argument.startsWith(`${name}=`));
    return option?.slice(name.length + 1);
  }

  options(name: string): string[] {
    return this.values
      .filter(argument => argument.startsWith(`${name}=`))
      .map(argument => argument.slice(name.length + 1));
  }

  positiveInteger(name: string, fallback: number): number {
    const value = this.option(name);
    if (value === undefined) return fallback;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive integer.`);
    }
    return parsed;
  }

  required(name: string): string {
    const value = this.option(name);
    if (!value) throw new Error(`${name} is required.`);
    return value;
  }
}
