const fs = require('fs');
const file = 'C:\\smartdeal\\smart-deal-app\\src\\app\\index.tsx';
let data = fs.readFileSync(file, 'utf8');

const targetStr = `  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    try {
      const res = await axios.post(\`\${BASE_URL}/register\`, {
        full_name: fullName, email, phone, password, role: 'buyer'
      });
      Alert.alert('สำเร็จ', res.data.message);
      setScreen('login');
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    }
  };`;

const newStr = `  const handleRequestRegisterOTP = async () => {
    if (!fullName || !email || !phone || !password) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรูปแบบอีเมลให้ถูกต้อง');
      return;
    }
    try {
      const res = await axios.post(\`\${BASE_URL}/register/request-otp\`, { email, phone });
      Alert.alert('สำเร็จ', res.data.message || 'ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว');
      setIsRegisterOtpStep(true);
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'ส่ง OTP ไม่สำเร็จ');
    }
  };

  const handleRegister = async () => {
    if (!registerOtp) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัส OTP');
      return;
    }
    try {
      const res = await axios.post(\`\${BASE_URL}/register\`, {
        full_name: fullName, email, phone, password, role: 'buyer', otp: registerOtp
      });
      Alert.alert('สำเร็จ', res.data.message);
      setScreen('login');
      setIsRegisterOtpStep(false);
      setRegisterOtp('');
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    }
  };`;

// normalize line endings to do a reliable replace
const normalize = str => str.replace(/\r\n/g, '\n').trim();

let normalizedData = data.replace(/\r\n/g, '\n');
let normalizedTarget = normalize(targetStr);

let index = normalizedData.indexOf(normalizedTarget);
if (index !== -1) {
    normalizedData = normalizedData.replace(normalizedTarget, newStr);
    fs.writeFileSync(file, normalizedData);
    console.log("Success");
} else {
    console.log("Failed to find target block");
}
