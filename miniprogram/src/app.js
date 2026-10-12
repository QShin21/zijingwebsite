App({
  globalData: { user: null },
  onLaunch: function () {
    // Private-file cleanup must not prevent the first page from starting.
    try { this.globalData.user = require('./lib/session').user(); }
    catch (error) { console.warn('Account initialization unavailable', error && error.name); }
    try { require('./lib/files').clearPrivate(); }
    catch (error) { console.warn('Private image cleanup unavailable', error && error.name); }
    try { require('./lib/privacy').setup(); }
    catch (error) { console.warn('Privacy authorization initialization unavailable', error && error.name); }
  },
});
