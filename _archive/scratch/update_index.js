const fs = require('fs');
const file = 'C:\\smartdeal\\smart-deal-app\\src\\app\\index.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /const \[phone, setPhone\] = useState\(''\);/,
  `const [phone, setPhone] = useState('');
  const [isRegisterOtpStep, setIsRegisterOtpStep] = useState(false);
  const [registerOtp, setRegisterOtp] = useState('');`
);

data = data.replace(
  /const handleRegister = async \(\) => \{[\s\S]*?\};\n/,
  `const handleRequestRegisterOTP = async () => {
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
  };\n`
);

data = data.replace(
  /\{screen === 'register' && \([\s\S]*?<\/View>\s*\)\}/,
  `{screen === 'register' && (
          <View style={styles.formContainer}>
            <Text style={styles.title}>สมัครสมาชิก</Text>
            <Text style={styles.subtitle}>สร้างบัญชีใหม่เพื่อใช้งาน Smart Deal</Text>

            {!isRegisterOtpStep ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ชื่อ-นามสกุล</Text>
                  <TextInput style={styles.input} placeholder="สมชาย ใจดี" value={fullName} onChangeText={setFullName} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>อีเมล</Text>
                  <TextInput style={styles.input} placeholder="อีเมล (ต้องเป็นอีเมลจริงเพื่อรับ OTP)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>เบอร์โทรศัพท์</Text>
                  <TextInput style={styles.input} placeholder="0812345678" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>รหัสผ่าน</Text>
                  <TextInput style={styles.input} placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleRequestRegisterOTP}>
                  <Text style={styles.primaryButtonText}>ขอรหัส OTP ยืนยันอีเมล</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.subtitle, { color: '#2e7a32', fontWeight: 'bold' }]}>
                  กรุณากรอกรหัส OTP ที่ส่งไปยังอีเมล {email}
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>รหัส OTP (6 หลัก)</Text>
                  <TextInput 
                    style={[styles.input, { textAlign: 'center', fontSize: 22, letterSpacing: 5 }]} 
                    placeholder="123456" 
                    keyboardType="number-pad" 
                    maxLength={6} 
                    value={registerOtp} 
                    onChangeText={setRegisterOtp} 
                  />
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
                  <Text style={styles.primaryButtonText}>ยืนยันการสมัครสมาชิก</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.primaryButton, { backgroundColor: '#f0f0f0', marginTop: 10 }]} 
                  onPress={() => setIsRegisterOtpStep(false)}
                >
                   <Text style={[styles.primaryButtonText, { color: '#333' }]}>ย้อนกลับแก้ไขข้อมูล</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={{ marginTop: 15, alignSelf: 'center' }} onPress={() => {
              setScreen('login');
              setIsRegisterOtpStep(false);
              setRegisterOtp('');
            }}>
              <Text style={styles.linkText}>← กลับไปหน้าเข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        )}`
);

fs.writeFileSync(file, data);
console.log('Update complete!');
