# Google Play Music History Scrobbler

Scrobbles tracks from Google Play Music activity from a Google Takeout archive to Last.fm.

## Configure
1. Download and unpack Google Play Music Activity from [Google Takeout](https://takeout.google.com/settings/takeout)
    * Select only **My Activity**
    * Choose **JSON** format
    * Include only **Google Play Music** activity

2. Get a Last.fm API key and secret on the [Last.fm Create API Account page](https://www.last.fm/api/account/create)

3. Create a `.env` file with the following variables:  
    ```
    API_KEY=<Last.fm API key>
    API_SECRET=<Last.fm API secret>
    ```

## Run
```
yarn ts-node index [-f <ISO-8601-formatted start time>] [-t <ISO-8601-formatted end time>] <Last.fm username> <JSON file with activity>
```

### Example
```
yarn ts-node index -f 2020-02-16T01:19:00+01:00 -t 2020-03-23T10:45:00+01:00 nezmar activity.json
```
