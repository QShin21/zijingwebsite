App({
  globalData: { user: null, theme: 'light' },
  onLaunch: function () {
    try { this.globalData.theme = require('./lib/theme').init(); }
    catch (error) { console.warn('Appearance initialization unavailable', error && error.name); }
    // Private-file cleanup must not prevent the first page from starting.
    try { this.globalData.user = require('./lib/session').user(); }
    catch (error) { console.warn('Account initialization unavailable', error && error.name); }
    try { require('./lib/files').clearPrivate(); }
    catch (error) { console.warn('Private image cleanup unavailable', error && error.name); }
    try { require('./lib/privacy').setup(); }
    catch (error) { console.warn('Privacy authorization initialization unavailable', error && error.name); }
  },
});
