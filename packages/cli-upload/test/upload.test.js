import fs from 'fs';
import path from 'path';
import mockAPI from '@percy/client/test/helpers';
import logger from '@percy/logger/test/helpers';
import { Upload } from '../src/commands/upload';

// http://png-pixel.com/
const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const cwd = process.cwd();

describe('percy upload', () => {
  beforeAll(() => {
    require('../src/hooks/init').default();

    fs.mkdirSync(path.join(__dirname, 'tmp'));
    process.chdir(path.join(__dirname, 'tmp'));

    fs.mkdirSync('images');
    fs.writeFileSync(path.join('images', 'test-1.png'), pixel);
    fs.writeFileSync(path.join('images', 'test-2.jpg'), pixel);
    fs.writeFileSync(path.join('images', 'test-3.jpeg'), pixel);
    fs.writeFileSync(path.join('images', 'test-4.gif'), pixel);
    fs.writeFileSync('nope', 'not here');
  });

  afterAll(() => {
    fs.unlinkSync('nope');
    fs.unlinkSync(path.join('images', 'test-1.png'));
    fs.unlinkSync(path.join('images', 'test-2.jpg'));
    fs.unlinkSync(path.join('images', 'test-3.jpeg'));
    fs.unlinkSync(path.join('images', 'test-4.gif'));
    fs.rmdirSync('images');

    process.chdir(cwd);
    fs.rmdirSync(path.join(__dirname, 'tmp'));
  });

  beforeEach(() => {
    process.env.PERCY_TOKEN = '<<PERCY_TOKEN>>';
    mockAPI.start();
    logger.mock();
  });

  afterEach(() => {
    delete process.env.PERCY_TOKEN;
    delete process.env.PERCY_ENABLE;
  });

  it('skips uploading when percy is disabled', async () => {
    process.env.PERCY_ENABLE = '0';
    await Upload.run(['./images']);

    expect(logger.stderr).toEqual([]);
    expect(logger.stdout).toEqual(['[percy] Percy is disabled. Skipping upload']);
  });

  it('errors when the directory is not found', async () => {
    await expectAsync(Upload.run(['./404'])).toBeRejectedWithError('EEXIT: 1');

    expect(logger.stdout).toEqual([]);
    expect(logger.stderr).toEqual([
      '[percy] Error: Not found: ./404'
    ]);
  });

  it('errors when the path is not a directory', async () => {
    await expectAsync(Upload.run(['./nope'])).toBeRejectedWithError('EEXIT: 1');

    expect(logger.stdout).toEqual([]);
    expect(logger.stderr).toEqual([
      '[percy] Error: Not a directory: ./nope'
    ]);
  });

  it('errors when there are no matching files', async () => {
    await expectAsync(Upload.run(['./images', '--files=no-match.png'])).toBeRejectedWithError('EEXIT: 1');

    expect(logger.stdout).toEqual([]);
    expect(logger.stderr).toEqual([
      '[percy] Error: No matching files found in \'./images\''
    ]);
  });

  it('creates a new build and uploads snapshots', async () => {
    await Upload.run(['./images']);

    expect(logger.stderr).toEqual([]);
    expect(logger.stdout).toEqual([
      '[percy] Percy has started!',
      '[percy] Created build #1: https://percy.io/test/test/123',
      '[percy] Snapshot uploaded: test-1.png',
      '[percy] Snapshot uploaded: test-2.jpg',
      '[percy] Snapshot uploaded: test-3.jpeg',
      '[percy] Finalized build #1: https://percy.io/test/test/123'
    ]);

    expect(mockAPI.requests['/builds/123/snapshots'][0].body).toEqual({
      data: {
        type: 'snapshots',
        attributes: {
          name: 'test-1.png',
          widths: [10],
          'minimum-height': 10,
          'enable-javascript': null
        },
        relationships: {
          resources: {
            data: jasmine.arrayContaining([{
              type: 'resources',
              id: jasmine.any(String),
              attributes: {
                'resource-url': '/test-1',
                mimetype: 'text/html',
                'is-root': true
              }
            }, {
              type: 'resources',
              id: jasmine.any(String),
              attributes: {
                'resource-url': '/test-1.png',
                mimetype: 'image/png',
                'is-root': null
              }
            }])
          }
        }
      }
    });
  });

  it('skips unsupported image types', async () => {
    await Upload.run(['./images', '--files=*']);

    expect(logger.stderr).toEqual([]);
    expect(logger.stdout).toEqual([
      '[percy] Percy has started!',
      '[percy] Created build #1: https://percy.io/test/test/123',
      '[percy] Snapshot uploaded: test-1.png',
      '[percy] Snapshot uploaded: test-2.jpg',
      '[percy] Snapshot uploaded: test-3.jpeg',
      '[percy] Skipping unsupported image type: test-4.gif',
      '[percy] Finalized build #1: https://percy.io/test/test/123'
    ]);
  });

  it('does not upload snapshots and prints matching files with --dry-run', async () => {
    await Upload.run(['./images', '--dry-run']);

    expect(logger.stderr).toEqual([]);
    expect(logger.stdout).toEqual([
      '[percy] Matching files:\n' +
        'test-1.png\n' +
        'test-2.jpg\n' +
        'test-3.jpeg'
    ]);
  });
});
