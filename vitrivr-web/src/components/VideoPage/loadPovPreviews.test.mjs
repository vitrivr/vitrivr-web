import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPovPreviews} from './loadPovPreviews.ts';

const videos = Array.from({length: 6}, (_, i) => ({id: `${i}`, name: `${i}`, kind: 'person', url: `video-${i}`, seekTime: 12}));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };

test('publishes a usable card before its thumbnail or the rest of the batch finishes', async () => {
    const thumbnail = deferred();
    const visible = deferred();
    const updates = [];
    const done = loadPovPreviews(videos.slice(0, 1), new AbortController().signal, video => {
        updates.push(video); visible.resolve();
    }, {exists: async () => true, thumbnail: () => thumbnail.promise});
    await visible.promise;
    assert.equal(updates.length, 1);
    assert.equal(updates[0].thumbnail, undefined);
    thumbnail.resolve('preview');
    await done;
    assert.equal(updates[1].thumbnail, 'preview');
    assert.equal(updates[1].seekTime, 12);
});

test('limits concurrent decoding and does not drop playable videos when preview generation fails', async () => {
    let active = 0;
    let maximum = 0;
    const updates = [];
    await loadPovPreviews(videos, new AbortController().signal, video => updates.push(video), {
        exists: async url => url !== 'video-5',
        thumbnail: async url => {
            active++; maximum = Math.max(maximum, active);
            await new Promise(resolve => setImmediate(resolve));
            active--;
            if (url === 'video-1') throw new Error('CORS');
            return 'preview';
        },
    }, 2);
    assert.equal(maximum, 2);
    assert.equal(new Set(updates.map(video => video.id)).size, 5);
    assert.equal(updates.find(video => video.id === '1').thumbnail, undefined);
});

test('closing the gallery prevents late updates and additional work', async () => {
    const controller = new AbortController();
    const thumbnail = deferred();
    let checks = 0;
    const updates = [];
    const done = loadPovPreviews(videos, controller.signal, video => {
        updates.push(video); controller.abort();
    }, {exists: async () => { checks++; return true; }, thumbnail: () => thumbnail.promise}, 1);
    await new Promise(resolve => setImmediate(resolve));
    thumbnail.resolve('late preview');
    await done;
    assert.equal(checks, 1);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].thumbnail, undefined);
});

test('does not publish or decode a video after an availability check is cancelled', async () => {
    const controller = new AbortController();
    const availability = deferred();
    let decoded = false;
    const updates = [];
    const done = loadPovPreviews(videos, controller.signal, video => updates.push(video), {
        exists: () => availability.promise,
        thumbnail: async () => { decoded = true; return 'preview'; },
    }, 1);
    controller.abort(); availability.resolve(true);
    await done;
    assert.equal(decoded, false);
    assert.deepEqual(updates, []);
});

test('slow decoders do not block availability checks for the remaining cameras', async () => {
    const thumbnail = deferred();
    const allVisible = deferred();
    let cards = 0;
    const done = loadPovPreviews(videos, new AbortController().signal, video => {
        if (!video.thumbnail && ++cards === videos.length) allVisible.resolve();
    }, {exists: async () => true, thumbnail: () => thumbnail.promise}, 2);
    await allVisible.promise;
    assert.equal(cards, videos.length);
    thumbnail.resolve('preview');
    await done;
});
