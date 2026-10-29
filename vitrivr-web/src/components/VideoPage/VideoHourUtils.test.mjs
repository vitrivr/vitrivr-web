import test from 'node:test';
import assert from 'node:assert/strict';
import {getPlaybackSource, getVideoAtOffset} from './VideoHourUtils.ts';

const stream = 'https://media.example/segments/id/master.m3u8';
const hourly = 'https://media.example/day1/Cathal/video/12.mp4';

test('keeps the original stream when returning to the search result hour', () => {
    assert.equal(getPlaybackSource(stream, hourly, 0), stream);
});

test('switches the main player to earlier and later hourly videos', () => {
    assert.equal(getPlaybackSource(stream, hourly, -1), hourly.replace('12.mp4', '11.mp4'));
    assert.equal(getPlaybackSource(stream, hourly, 2), hourly.replace('12.mp4', '14.mp4'));
    assert.equal(getVideoAtOffset(hourly, 1), getPlaybackSource(stream, hourly, 1));
});

test('rejects navigation outside the recording day', () => {
    assert.equal(getPlaybackSource(stream, hourly, -13), null);
    assert.equal(getPlaybackSource(stream, hourly, 12), null);
    assert.equal(getPlaybackSource(stream, hourly, -12), hourly.replace('12.mp4', '0.mp4'));
    assert.equal(getPlaybackSource(stream, hourly, 11), hourly.replace('12.mp4', '23.mp4'));
});

test('does not rewrite HLS playlists when an hourly source is missing', () => {
    assert.equal(getPlaybackSource(stream, '', 0), stream);
    assert.equal(getPlaybackSource(stream, '', 1), null);
    assert.equal(getPlaybackSource(stream, stream, -1), null);
});

test('VBS keeps unrelated numeric files and signed URLs unchanged even after CASTLE hour navigation', async () => {
    const {getVideoViewPlayback}=await import('./VideoHourUtils.ts');
    for(const file of ['https://media.example/012.mp4','https://media.example/collection/movie.mp4?token=example#clip']) {
        assert.deepEqual(getVideoViewPlayback('VBS',file,file,2),{offset:0,file,src:file});
    }
    assert.deepEqual(getVideoViewPlayback('VBS',stream,hourly,-1),{offset:0,file:hourly,src:stream});
    assert.deepEqual(getVideoViewPlayback('VBS','',hourly,3),{offset:0,file:hourly,src:hourly});
});

test('CASTLE retains hourly playback and returning to the original result stream', async () => {
    const {getVideoViewPlayback}=await import('./VideoHourUtils.ts');
    assert.deepEqual(getVideoViewPlayback('CASTLE',stream,hourly,-1),{offset:-1,file:hourly.replace('12.mp4','11.mp4'),src:hourly.replace('12.mp4','11.mp4')});
    assert.deepEqual(getVideoViewPlayback('CASTLE',stream,hourly,0),{offset:0,file:hourly,src:stream});
});

test('submission filenames work without a recording hierarchy and strip signed URL parameters', async () => {
    const {getVideoFilename}=await import('./VideoHourUtils.ts');
    assert.equal(getVideoFilename('film.mp4'),'film.mp4');
    assert.equal(getVideoFilename('https://media.example/videos/My%20Video.mp4?token=example#t=12'),'My Video.mp4');
    assert.equal(getVideoFilename('C:\\videos\\clip.mp4'),'clip.mp4');
    assert.equal(getVideoFilename('https://media.example/%invalid.mp4'),'%invalid.mp4');
});
