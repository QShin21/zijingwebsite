const session = require('./lib/session');
const files = require('./lib/files');

App({
  globalData: { user: null },
  onLaunch() {
    this.globalData.user = session.user();
    files.clearPrivate();
  },
  onHide() {
    // Pages stop their live requests in onHide; credentials stay on this device.
  },
});
