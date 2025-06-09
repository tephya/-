// 登录弹窗重构版本 - 使用通用工具库

// DOM元素引用
const loginElements = {
    overlay: document.getElementById('login-overlay'),
    loginPopup: document.getElementById('login-popup'),
    registerPopup: document.getElementById('register-popup'),
    passwordModeBtn: document.getElementById('password-mode-btn'),
    captchaModeBtn: document.getElementById('captcha-mode-btn'),
    passwordLoginArea: document.getElementById('password-login-area'),
    captchaLoginArea: document.getElementById('captcha-login-area'),
    accountInput: document.getElementById('account-input'),
    passwordInput: document.getElementById('password-input'),
    passwordLoginBtn: document.getElementById('password-login-btn'),
    passwordError: document.getElementById('password-error'),
    phoneInput: document.getElementById('phone-input'),
    getCodeBtn: document.getElementById('get-code-btn'),
    verificationCodeArea: document.getElementById('verification-code-area'),
    registerForm: document.getElementById('register-form'),
    userIdInput: document.getElementById('user-id'),
    usernameInput: document.getElementById('username')
};

// 登录模式管理
class LoginModeManager {
    static switchToPasswordMode() {
        if (!loginElements.passwordModeBtn.classList.contains('active')) {
            loginElements.passwordModeBtn.classList.add('active');
            loginElements.captchaModeBtn.classList.remove('active');
            loginElements.passwordLoginArea.style.display = 'block';
            loginElements.captchaLoginArea.style.display = 'none';
            LoginModeManager.clearLoginForm();
        }
    }

    static switchToCaptchaMode() {
        if (!loginElements.captchaModeBtn.classList.contains('active')) {
            loginElements.captchaModeBtn.classList.add('active');
            loginElements.passwordModeBtn.classList.remove('active');
            loginElements.captchaLoginArea.style.display = 'block';
            loginElements.passwordLoginArea.style.display = 'none';
            LoginModeManager.clearLoginForm();
        }
    }

    static clearLoginForm() {
        FormValidator.clearFields([
            'account-input', 
            'password-input', 
            'phone-input', 
            'password-error', 
            'verification-code-area'
        ]);
        
        // 重置验证码按钮
        if (codeManager) {
            codeManager.resetButton('get-code-btn');
        }
    }
}

// 弹窗操作
function showLoginPopup() {
    PopupManager.show('login-popup');
}

function closeLoginPopup() {
    PopupManager.close('login-popup', () => LoginModeManager.clearLoginForm());
}

function showRegisterPopup() {
    closeLoginPopup();
    PopupManager.show('register-popup', () => generateUserInfo());
}

function closeRegisterPopup() {
    PopupManager.close('register-popup', () => clearRegisterForm());
}

// 生成用户信息（注册用）
function generateUserInfo() {
    if (loginElements.userIdInput) {
        loginElements.userIdInput.value = UserManager.generateUserId();
    }
    if (loginElements.usernameInput) {
        loginElements.usernameInput.value = UserManager.generateUsername();
    }
}

// 清空注册表单
function clearRegisterForm() {
    if (loginElements.registerForm) {
        loginElements.registerForm.reset();
        FormValidator.clearFields(['user-id', 'username', 'real-name']);
    }
}

// 密码登录处理
async function handlePasswordLogin() {
    const account = loginElements.accountInput.value.trim();
    const password = loginElements.passwordInput.value.trim();
    
    if (!account || !password) {
        loginElements.passwordError.textContent = '请输入账户和密码';
        return;
    }
    
    try {
        // 直接验证登录
        const loginResult = await APIManager.validatePassword(account, password);
        
        if (loginResult.success) {
            loginElements.passwordError.textContent = '';
            alert('登录成功！');
            
            // 设置登录状态
            UserManager.setLoginStatus(loginResult.phone || account);
            
            // 保存额外的用户信息
            if (loginResult.userId) {
                localStorage.setItem('customer_id', loginResult.userId);
            }
            if (loginResult.userName) {
                localStorage.setItem('customer_name', loginResult.userName);
                localStorage.setItem('customer_username', loginResult.userName);
            }
            if (loginResult.phone) {
                localStorage.setItem('customer_phone', loginResult.phone);
            }
            
            closeLoginPopup();
            
            // 更新UI状态
            if (typeof UIStateManager !== 'undefined') {
                UIStateManager.updateLoginUI();
            }
        } else {
            // 显示具体错误信息
            const errorMessage = loginResult.message || '登录失败';
            if (errorMessage.includes('密码错误')) {
                loginElements.passwordError.textContent = '密码错误，请重新输入';
            } else {
                loginElements.passwordError.textContent = '账户不存在或密码错误';
            }
        }
    } catch (error) {
        console.error('登录错误:', error);
        loginElements.passwordError.textContent = '登录失败，请检查网络连接';
    }
}

// 验证码登录处理
function handleCaptchaLogin() {
    const phone = loginElements.phoneInput.value.replace(/\s/g, '');
    
    if (!FormValidator.validatePhone(phone)) {
        return;
    }
    
    const verificationCode = codeManager.generateCode();
    codeManager.startCountdown('get-code-btn');
    
    // 创建验证码输入区域
    const codeInput = codeManager.createCodeInput('verification-code-area', verificationCode);
    
    // 处理验证码验证
    codeManager.handleCodeInput(codeInput, verificationCode, async () => {
        const user_exists = await APIManager.checkPhoneExists(phone);
        
        if (user_exists) {
            alert('登录成功！');
            UserManager.setLoginStatus(phone);
            
            // 获取并保存用户信息
            APIManager.getUserInfo(phone).then(result => {
                if (result.success && result.data) {
                    localStorage.setItem('customer_id', result.data.customer_id);
                    localStorage.setItem('customer_name', result.data.customer_name);
                    localStorage.setItem('customer_username', result.data.customer_username);
                    localStorage.setItem('customer_phone', result.data.customer_phone);
                }
            });
            
            closeLoginPopup();
            if (typeof UIStateManager !== 'undefined') {
                UIStateManager.updateLoginUI();
            }
        } else {
            // 保存手机号并显示注册弹窗
            localStorage.setItem('tempPhone', phone);
            showRegisterPopup();
            // 在注册表单中设置手机号
            const registerPhoneInput = document.getElementById('register-phone');
            if (registerPhoneInput) {
                registerPhoneInput.value = phone;
            }
        }
    });
}

// 事件监听器初始化
function initEventListeners() {
    // 初始化遮罩层点击关闭 - 包含所有弹窗
    PopupManager.initOverlayClose('login-overlay', [
        'login-popup', 
        'register-popup',
        'change-password-popup',
        'change-username-popup', 
        'change-phone-popup'
    ]);
    
    // 登录模式切换 - 使用箭头函数保持this绑定
    if (loginElements.passwordModeBtn) {
        loginElements.passwordModeBtn.addEventListener('click', () => LoginModeManager.switchToPasswordMode());
    }
    if (loginElements.captchaModeBtn) {
        loginElements.captchaModeBtn.addEventListener('click', () => LoginModeManager.switchToCaptchaMode());
    }
    
    // 密码登录
    if (loginElements.passwordLoginBtn) {
        loginElements.passwordLoginBtn.addEventListener('click', handlePasswordLogin);
    }
    
    // 手机号输入格式化和验证码按钮状态
    if (loginElements.phoneInput) {
        FormValidator.formatPhoneInput(loginElements.phoneInput);
        loginElements.phoneInput.addEventListener('input', function() {
            const phone = this.value.replace(/\s/g, '');
            const isValid = FormValidator.validatePhone(phone);
            loginElements.getCodeBtn.disabled = !isValid;
            
            if (isValid) {
                loginElements.getCodeBtn.classList.add('enabled');
            } else {
                loginElements.getCodeBtn.classList.remove('enabled');
            }
        });
    }
    
    // 获取验证码
    if (loginElements.getCodeBtn) {
        loginElements.getCodeBtn.addEventListener('click', function() {
            if (!this.disabled) {
                handleCaptchaLogin();
            }
        });
    }
    
    // 注册表单提交处理
    if (loginElements.registerForm) {
        loginElements.registerForm.addEventListener('submit', handleRegisterSubmit);
    }
}

// 注册表单提交处理
async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const realName = document.getElementById('real-name').value.trim();
    
    // 验证姓名
    if (!realName) {
        alert('请输入姓名');
        return;
    }
    
    // 验证密码
    if (password !== confirmPassword) {
        alert('两次输入的密码不一致！');
        return;
    }
    
    // 验证密码格式
    if (!FormValidator.validatePassword(password)) {
        alert('密码必须是6-16位，包含字母和数字');
        return;
    }
    
    const userData = {
        customer_id: document.getElementById('user-id').value,
        customer_username: document.getElementById('username').value,
        password: password,
        customer_name: realName,
        customer_sex: document.getElementById('gender').value,
        customer_phone: document.getElementById('register-phone').value,
        customer_address: document.getElementById('address').value
    };
    
    console.log('准备发送的用户数据:', userData);
    
    try {
        const success = await APIManager.insertUserData(userData);
        
        if (success) {
            alert('注册成功！');
            // 新增：注册成功后，保存所有新用户信息
            localStorage.setItem('customer_id', userData.customer_id);
            localStorage.setItem('customer_name', userData.customer_name);
            localStorage.setItem('customer_username', userData.customer_username);
            localStorage.setItem('customer_phone', userData.customer_phone);
            localStorage.removeItem('tempPhone');
            closeRegisterPopup();
            if (typeof UIStateManager !== 'undefined') {
                UIStateManager.updateLoginUI();
            }
        } else {
            alert('注册失败，请检查注册信息');
        }
    } catch (error) {
        console.error('注册错误:', error);
        alert('注册失败，请稍后重试');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    
    // 检查登录状态
    if (typeof UIStateManager !== 'undefined') {
        UIStateManager.updateLoginUI();
    }
});

// 导出主要函数供外部调用
window.showLoginPopup = showLoginPopup;
window.closeLoginPopup = closeLoginPopup;
window.showRegisterPopup = showRegisterPopup;
window.closeRegisterPopup = closeRegisterPopup;

// 导出登录模式切换函数供HTML调用
window.switchToPasswordMode = () => LoginModeManager.switchToPasswordMode();
window.switchToCaptchaMode = () => LoginModeManager.switchToCaptchaMode(); 