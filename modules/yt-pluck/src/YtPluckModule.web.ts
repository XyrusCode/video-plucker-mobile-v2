import { NativeModule } from 'expo';

// Web has no yt-dlp engine — every call is a no-op so the app bundle doesn't crash.
class YtPluckModule extends NativeModule<{}> {
  initEngineAsync() {
    return Promise.resolve(false);
  }
  updateEngineAsync() {
    return Promise.resolve(false);
  }
  probeAsync() {
    return Promise.reject(new Error('Not supported on web'));
  }
  startDownloadAsync() {
    return Promise.resolve(null);
  }
  pauseDownloadAsync() {}
  resumeDownloadAsync() {}
  cancelDownloadAsync() {}
  getCookiesAsync() {
    return null;
  }
  saveCookiesFileAsync() {
    return Promise.resolve(null);
  }
  queryHistoryAsync() {
    return Promise.resolve([]);
  }
  getInitialSharedUrl() {
    return null;
  }
}

export default new YtPluckModule();