// GitHub Actions のログで読みやすい出力。秘密の値はここを通さない。

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  group<T>(title: string, fn: () => Promise<T>): Promise<T>;
}

const inActions = Boolean(process.env.GITHUB_ACTIONS);

export function createLogger(quiet = false): Logger {
  return {
    info: (m) => {
      if (!quiet) console.log(m);
    },
    warn: (m) => console.warn(inActions ? `::warning::${m}` : `⚠ ${m}`),
    error: (m) => console.error(inActions ? `::error::${m}` : `✖ ${m}`),
    async group(title, fn) {
      if (!quiet) console.log(inActions ? `::group::${title}` : `\n── ${title} ──`);
      try {
        return await fn();
      } finally {
        if (!quiet && inActions) console.log('::endgroup::');
      }
    },
  };
}

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  group: (_t, fn) => fn(),
};
