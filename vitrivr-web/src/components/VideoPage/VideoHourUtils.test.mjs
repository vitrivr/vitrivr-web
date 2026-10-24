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
