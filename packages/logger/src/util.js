const { assign, entries } = Object;

// matches ansi escape sequences
export const ANSI_REG = new RegExp((
  '[\\u001B\\u009B][[\\]()#;?]*((?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)' +
  '|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
), 'g');

// color names by ansi escape code
export const ANSI_COLORS = {
  '31m': 'red',
  '33m': 'yellow',
  '34m': 'blue',
  '35m': 'magenta',
  '90m': 'grey'
};

// colorize each line of a string using an ansi escape sequence
const LINE_REG = /^.*$/gm;
function colorize(code, str) {
  return str.replace(LINE_REG, line => (
    `\u001b[${code}${line}\u001b[39m`
  ));
}

// map ansi colors to bound colorize functions
export const colors = entries(ANSI_COLORS)
  .reduce((colors, [code, name]) => {
    return assign(colors, {
      [name]: colorize.bind(null, code)
    });
  }, {});

// adds an event listener and returns a teardown function
export function listen(subject, event, handler, teardown) {
  subject.addEventListener(event, handler);

  return () => {
    subject.removeEventListener(event, handler);
    return teardown?.();
  };
}
