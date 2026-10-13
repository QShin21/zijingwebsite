function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
Page(withVisualTheme({
  data: { mode: 'login', identifier: '', password: '', name: '', emailPrefix: '', emailDomain: 'mails.tsinghua.edu.cn',
    domains: ['mails.tsinghua.edu.cn', 'tsinghua.org.cn', 'tsinghua.edu.cn', 'mail.tsinghua.edu.cn', 'mail.tsinghua.org.cn'],
    email: '', confirm: '', code: '', error: '', busy: false, sent: false, countdown: 0, bridge: true },
  ...actions,
  onLoad(options) {
    this.setMode(['register', 'reset'].includes(options.mode) ? options.mode : 'login');
    this.retryBridge();
  },
  retryBridge() {
    const ticket = this._bridgeTicket = (this._bridgeTicket || 0) + 1;
    return http.request('/api/miniapp/status', { auth: false }).then(result => {
      if (ticket === this._bridgeTicket) this.setData({ bridge: Boolean(result && Array.isArray(result.authentication) && result.authentication.includes('email') && result.authentication.includes('nickname') && result.registration === true) });
    }).catch(() => { if (ticket === this._bridgeTicket) this.setData({ bridge: false }); });
  },
  onUnload() { this._bridgeTicket = (this._bridgeTicket || 0) + 1; clearInterval(this._countdown); this.setData({ password: '', confirm: '', code: '' }); },
  setMode(mode) { this.setData({ mode, error: '', sent: false, password: '', confirm: '', code: '' }); wx.setNavigationBarTitle({ title: { login: '登录紫荆', register: '注册账号', reset: '重设密码' }[mode] }); },
  switchMode(event) { this.setMode(event.currentTarget.dataset.mode); },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value, error: '' }); },
  domain(event) { this.setData({ emailDomain: this.data.domains[Number(event.detail.value)] }); },
  values() { return { identifier: this.data.identifier.trim(), password: this.data.password, confirm: this.data.confirm,
    name: this.data.name.trim(), emailPrefix: this.data.emailPrefix.trim(), emailDomain: this.data.emailDomain,
    email: this.data.email.trim(), code: this.data.code.trim() }; },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const values = this.values();
      if (this.data.mode === 'login') {
        if (!values.identifier || !values.password) throw new Error('请填写账号和密码');
        let result;
        if (this.data.bridge) result = await http.request('/api/miniapp/auth/login', { auth: false, method: 'POST', data: values });
        else {
          if (!values.identifier.includes('@')) throw new Error('网站接口更新前，请使用完整邮箱登录');
          result = await http.request('/api/users/login', { auth: false, method: 'POST', data: { email: values.identifier.toLowerCase(), password: values.password } });
        }
        session.save(result); this.setData({ password: '', confirm: '', code: '' });
        wx.showToast({ title: '登录成功', icon: 'success' });
        const stack = getCurrentPages();
        if (stack.length > 1) wx.navigateBack(); else navigation.go('account');
      } else {
        if (!this.data.bridge) throw new Error('注册与重设密码需要更新网站服务接口');
        if (values.password.length < 8 || values.password !== values.confirm) throw new Error('密码至少 8 位，两次输入需一致');
        if (!/^\d{6}$/.test(values.code)) throw new Error('请输入六位邮箱验证码');
        await http.request(this.data.mode === 'register' ? '/api/miniapp/auth/register/complete' : '/api/miniapp/auth/password/reset', { auth: false, method: 'POST', data: values });
        session.clear(); this.setMode('login'); wx.showToast({ title: '已完成，请登录', icon: 'none' });
      }
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  async sendCode() {
    if (this.data.busy || this.data.countdown) return;
    this.setData({ busy: true, error: '' });
    try {
      if (!this.data.bridge) throw new Error('邮箱验证需要更新网站服务接口');
      const values = this.values();
      if (this.data.mode === 'register') {
        if (!values.name || !values.emailPrefix || values.password.length < 8 || values.password !== values.confirm) throw new Error('请先填写昵称、邮箱和两次相同的密码');
      } else if (!values.email.includes('@')) throw new Error('请填写完整清华邮箱');
      await http.request(this.data.mode === 'register' ? '/api/miniapp/auth/register/begin' : '/api/miniapp/auth/password/code', { auth: false, method: 'POST', data: values });
      this.setData({ sent: true, countdown: 60 });
      clearInterval(this._countdown);
      this._countdown = setInterval(() => { const countdown = Math.max(0, this.data.countdown - 1); this.setData({ countdown }); if (!countdown) clearInterval(this._countdown); }, 1000);
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
}));
