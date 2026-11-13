function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const titles = { login: ['登录紫荆', 'Sign in'], register: ['注册账号', 'Create account'], reset: ['重设密码', 'Reset password'] };
const text = { back: ['‹ 返回', '‹ Back'], kicker: ['紫荆赛场 · 账号', 'Zijing Arena · Account'], titleLogin: ['登录紫荆', 'Sign in'], titleRegister: ['注册账号', 'Create account'], titleReset: ['重设密码', 'Reset password'],
  leadLogin: ['继续刚才的报名、申请或社群浏览。', 'Continue your sign-up, application or community browsing.'], leadRegister: ['用清华师生或校友邮箱验证，建立你的紫荆账号。', 'Verify with a Tsinghua or alumni email to create your Zijing account.'], leadReset: ['验证注册邮箱，为账号设置新的密码。', 'Verify your registered email to set a new password.'],
  modeLogin: ['登录', 'Sign in'], modeRegister: ['注册', 'Register'], modeReset: ['找回', 'Recover'],
  bridgeTitle: ['请重新检查账号服务', 'Please recheck the account service'], bridgeLogin: ['目前可尝试使用完整邮箱登录。昵称登录需重新检查服务后继续。', 'You can sign in with your full email for now. Nickname sign-in needs the service to be rechecked.'], bridgeOther: ['服务连接确认后，可继续获取验证码并完成验证。', 'Once the service is confirmed, you can get a code and finish verification.'], bridgeRetry: ['重新检查账号服务', 'Recheck account service'],
  sheetLogin: ['账号登录', 'Account sign-in'], sheetProfile: ['账号资料', 'Account details'], requiredHint: ['带 * 的项目均需填写。', 'Fields marked * are required.'],
  identifierLabel: ['昵称或邮箱', 'Nickname or email'], emailFull: ['完整邮箱', 'Full email'], identifierAria: ['昵称或完整邮箱', 'Nickname or full email'], identifierPlaceholder: ['输入昵称或完整邮箱', 'Enter nickname or full email'], identifierPlaceholderEmail: ['输入网站账号邮箱', 'Enter your website account email'],
  nickname: ['昵称', 'Nickname'], nicknamePlaceholder: ['输入昵称', 'Enter nickname'], nicknameHint: ['2–40 字，昵称不区分大小写。', '2–40 characters; nicknames are case-insensitive.'],
  email: ['邮箱', 'Email'], emailPrefixAria: ['邮箱前缀', 'Email name'], emailPrefixPlaceholder: ['@ 前的邮箱名', 'Name before @'], emailDomainAria: ['邮箱后缀', 'Email domain'], emailDomainPlaceholder: ['@ 后的邮箱域名', 'Domain after @'],
  emailHint: ['填写 @ 前后的两部分。清华及校友邮箱对应清华用户，其他教育邮箱对应友校学生，普通邮箱对应校外人士。', 'Fill in both parts around @. Tsinghua and alumni emails count as Tsinghua users, other education emails as peer-school students, and other emails as external users.'],
  resetEmailPlaceholder: ['输入注册使用的邮箱', 'Enter your registered email'], newPassword: ['新密码', 'New password'], password: ['密码', 'Password'],
  hidePassword: ['隐藏密码', 'Hide password'], showPassword: ['显示密码', 'Show password'], hide: ['隐藏', 'Hide'], show: ['显示', 'Show'], passwordPlaceholder: ['输入密码', 'Enter password'], passwordMin: ['至少 8 位', 'At least 8 characters'], passwordHint: ['至少 8 位，两次输入需一致。', 'At least 8 characters; both entries must match.'],
  confirm: ['确认密码', 'Confirm password'], confirmPlaceholder: ['再次输入密码', 'Enter the password again'],
  verifyTitle: ['邮箱验证', 'Email verification'], verifyRegister: ['填写好账号资料，再获取验证码。验证完成后返回登录。', 'Fill in your details, then get a code. Sign in after verification.'], verifyReset: ['获取注册邮箱的验证码，验证后保存新密码。', 'Get a code for your registered email, then save the new password.'],
  codeLabel: ['六位验证码', '6-digit code'], codeAria: ['邮箱验证码', 'Email verification code'], codePlaceholder: ['输入验证码', 'Enter code'], resendSuffix: [' 秒后重发', 's to resend'], getCode: ['获取验证码', 'Get code'],
  sentTitle: ['验证码已发送', 'Code sent'], sentBody: ['请检查收件箱与垃圾邮件。验证码十分钟内有效。', 'Check your inbox and spam folder. The code is valid for ten minutes.'], busy: ['正在处理，请稍候。', 'Working, please wait.'],
  submitLogin: ['登录并继续', 'Sign in and continue'], submitRegister: ['验证并注册', 'Verify and register'], submitReset: ['重设密码', 'Reset password'],
  backToLogin: ['返回登录', 'Back to sign-in'], register: ['注册账号', 'Create account'], forgot: ['忘记密码', 'Forgot password'], privacy: ['阅读隐私说明', 'Read the privacy notice'] };
Page(withVisualTheme({
  data: { mode: 'login', identifier: '', password: '', name: '', emailPrefix: '', emailDomain: 'mails.tsinghua.edu.cn',
    email: '', confirm: '', code: '', error: '', busy: false, sent: false, countdown: 0, bridge: true, showPassword: false },
  ...actions,
  onLoad(options) {
    i18n.bind(this, text);
    this.setMode(['register', 'reset'].includes(options.mode) ? options.mode : 'login');
    this.retryBridge();
  },
  retryBridge() {
    const ticket = this._bridgeTicket = (this._bridgeTicket || 0) + 1;
    return http.request('/api/miniapp/status', { auth: false }).then(result => {
      if (ticket === this._bridgeTicket) this.setData({ bridge: Boolean(result && Array.isArray(result.authentication) && result.authentication.includes('email') && result.authentication.includes('nickname') && result.registration === true) });
    }).catch(() => { if (ticket === this._bridgeTicket) this.setData({ bridge: false }); });
  },
  onShow() { const title = titles[this.data.mode] || titles.login; i18n.navTitle(title[0], title[1]); },
  onUnload() { i18n.unbind(this); this._bridgeTicket = (this._bridgeTicket || 0) + 1; clearInterval(this._countdown); this.setData({ password: '', confirm: '', code: '' }); },
  setMode(mode) { this.setData({ mode, error: '', sent: false, password: '', confirm: '', code: '', showPassword: false }); i18n.navTitle(titles[mode][0], titles[mode][1]); },
  switchMode(event) { this.setMode(event.currentTarget.dataset.mode); },
  togglePassword() { this.setData({ showPassword: !this.data.showPassword }); },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value, error: '' }); },
  values() { return { identifier: this.data.identifier.trim(), password: this.data.password, confirm: this.data.confirm,
    name: this.data.name.trim(), emailPrefix: this.data.emailPrefix.trim(), emailDomain: this.data.emailDomain.trim(),
    email: this.data.email.trim(), code: this.data.code.trim() }; },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const values = this.values();
      if (this.data.mode === 'login') {
        if (!values.identifier || !values.password) throw new Error(i18n.t('请填写账号和密码', 'Enter your account and password'));
        let result;
        if (this.data.bridge) result = await http.request('/api/miniapp/auth/login', { auth: false, method: 'POST', data: values });
        else {
          if (!values.identifier.includes('@')) throw new Error(i18n.t('网站接口更新前，请使用完整邮箱登录', 'Until the website service is updated, sign in with your full email'));
          result = await http.request('/api/users/login', { auth: false, method: 'POST', data: { email: values.identifier.toLowerCase(), password: values.password } });
        }
        session.save(result); this.setData({ password: '', confirm: '', code: '' });
        wx.showToast({ title: i18n.t('登录成功', 'Signed in'), icon: 'success' });
        const stack = getCurrentPages();
        if (stack.length > 1) wx.navigateBack({ fail() { navigation.go('account'); } }); else navigation.go('account');
      } else {
        if (!this.data.bridge) throw new Error(i18n.t('注册与重设密码需要更新网站服务接口', 'Registration and password reset need an updated website service'));
        if (values.password.length < 8 || values.password !== values.confirm) throw new Error(i18n.t('密码至少 8 位，两次输入需一致', 'The password needs at least 8 characters and both entries must match'));
        if (!/^\d{6}$/.test(values.code)) throw new Error(i18n.t('请输入六位邮箱验证码', 'Enter the 6-digit email code'));
        await http.request(this.data.mode === 'register' ? '/api/miniapp/auth/register/complete' : '/api/miniapp/auth/password/reset', { auth: false, method: 'POST', data: values });
        session.clear(); this.setMode('login'); wx.showToast({ title: i18n.t('已完成，请登录', 'Done. Please sign in'), icon: 'none' });
      }
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  async sendCode() {
    if (this.data.busy || this.data.countdown) return;
    this.setData({ busy: true, error: '' });
    try {
      if (!this.data.bridge) throw new Error(i18n.t('邮箱验证需要更新网站服务接口', 'Email verification needs an updated website service'));
      const values = this.values();
      if (this.data.mode === 'register') {
        if (!values.name || !values.emailPrefix || !values.emailDomain || values.password.length < 8 || values.password !== values.confirm) throw new Error(i18n.t('请先填写昵称、邮箱和两次相同的密码', 'First enter a nickname, email and the same password twice'));
      } else if (!values.email.includes('@')) throw new Error(i18n.t('请填写注册时验证的完整邮箱', 'Enter the full email you verified at registration'));
      await http.request(this.data.mode === 'register' ? '/api/miniapp/auth/register/begin' : '/api/miniapp/auth/password/code', { auth: false, method: 'POST', data: values });
      this.setData({ sent: true, countdown: 60 });
      clearInterval(this._countdown);
      this._countdown = setInterval(() => { const countdown = Math.max(0, this.data.countdown - 1); this.setData({ countdown }); if (!countdown) clearInterval(this._countdown); }, 1000);
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
}));
