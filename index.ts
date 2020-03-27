import {promises as fs} from 'fs';
import moment, {Moment} from 'moment';
import LastFm from 'lastfm-node-client';
import chunk from 'lodash/chunk';
import parseArgs from 'minimist';
import dotenv from 'dotenv';
import readline from 'readline-sync';

const LISTEN_EVENT_PREFIX = 'Listened to ';

type ActivityEntry = {
  title: string;
  description: string;
  time: string;
}

type Scrobble = {
  artist: string;
  track: string;
  timestamp: number;
}

const since = (time: Moment) => (entry: ActivityEntry): boolean => moment(entry.time).isAfter(time);

const until = (time: Moment) => (entry: ActivityEntry): boolean => moment(entry.time).isBefore(time);

const isListenEvent = (entry: ActivityEntry): boolean => entry.title.startsWith(LISTEN_EVENT_PREFIX);

const activityToScrobble = (entry: ActivityEntry): Scrobble => ({
  artist: entry.description,
  track: entry.title.substring(LISTEN_EVENT_PREFIX.length),
  timestamp: moment(entry.time).unix()
});

const printIgnoredScrobbles = (responseScrobbles: any) => {
  const scrobbles = Array.isArray(responseScrobbles)
    ? responseScrobbles
    : [responseScrobbles];

  const ignoredScrobbles = scrobbles.filter(scrobble =>
    scrobble.ignoredMessage.code !== '0' ||
    scrobble.ignoredMessage['#text'] !== ''
  );

  ignoredScrobbles.forEach(scrobble => {
    console.log(`  - ${scrobble.track['#text']} by ${scrobble.artist['#text']} at ${moment.unix(Number(scrobble.timestamp)).format()}`)
    console.log(`    because: ${scrobble.ignoredMessage['#text']} (code ${scrobble.ignoredMessage.code})`)
  });
}

const printScrobbleResponse = (resp: any) => {
  console.log(`  Accepted: ${resp.scrobbles['@attr'].accepted}`);

  if (Number(resp.scrobbles['@attr'].ignored) > 0) {
    console.log(`  Ignored: ${resp.scrobbles['@attr'].ignored}`);

    printIgnoredScrobbles(resp.scrobbles.scrobble);
  }
};

const getScrobblesFromActivity = async (filePath: string, start: Moment, end: Moment): Promise<Scrobble[]> => {
  if (!filePath) {
    throw new Error('Provide a path to an activity JSON file');
  }

  try {
    const file = await fs.readFile(filePath, {encoding: 'utf-8'});
    const activity = JSON.parse(file) as ActivityEntry[];

    return activity
      .filter(isListenEvent)
      .filter(since(moment().subtract(2, 'weeks'))) // Last.fm API won't allow scrobbles older than 2 weeks
      .filter(since(start))
      .filter(until(end))
      .map(activityToScrobble);
  } catch (e) {
    throw new Error(`Couldn't parse activity JSON file '${filePath}'`);
  }
}

const getLastFmSession = async (apiKey: string, apiSecret: string, username: string, password: string): Promise<LastFm> => {
  console.log(`Logging into Last.fm as ${username}`);
  const sessionResponse = await new LastFm(apiKey, apiSecret).authGetMobileSession({
    username,
    password
  });
  return new LastFm(apiKey, apiSecret, sessionResponse.session.key);
}

const doScrobble = async (
  lastFmSession: LastFm,
  scrobbles: Scrobble[]
) => {
  const toScrobble = chunk(scrobbles, 50);

  for (const [batchIndex, batch] of toScrobble.entries()) {
    console.log(`Processing batch ${batchIndex}`);
    console.log(`  Will scrobble ${batch.length} tracks:`);
    batch.forEach(track => console.log(`  - ${track.track} by ${track.artist} at ${moment.unix(track.timestamp).format()}`));

    const scrobbleResponse = await lastFmSession.trackScrobbleMany(batch);

    printScrobbleResponse(scrobbleResponse);
  }
}

const main = async () => {
  // parse command line args
  const parsedArgs = parseArgs(process.argv.slice(2));
  const start = parsedArgs.f || moment().subtract(2, 'weeks');
  const end = parsedArgs.t || moment();
  const [username, filePath] = parsedArgs._;

  try {
    // parse .env
    dotenv.config();
    const apiKey = process.env.API_KEY
    const apiSecret = process.env.API_SECRET

    // get activity to scrobble
    const scrobbles = await getScrobblesFromActivity(filePath, start, end);

    // ask for password
    const password = readline.question('Last.fm password: ', {
      hideEchoBack: true
    });

    // get Last.fm session
    const lfm = await getLastFmSession(apiKey, apiSecret, username, password);

    // scrobble
    await doScrobble(lfm, scrobbles);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
