const fs = require('fs');
const path = 'c:/smartdealrider/smartdeal-rider/src/app/delivery/[id].tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace imports
content = content.replace("import { useLocalSearchParams, useRouter } from 'expo-router';", 
  "import { useLocalSearchParams, useRouter } from 'expo-router';\nimport api from '../../utils/api';\nimport { ActivityIndicator } from 'react-native';");

// Replace component start
const targetStr = `export default function DeliveryRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [status, setStatus] = useState('ongoing'); // picked_up, ongoing, completed

  const customerName = 'คุณสมชาย ใจดี';
  const customerPhone = '081-234-5678';
  const deliveryAddress = '123/45 คอนโดสมาร์ท เพลส ชั้น 12 ห้อง 1205 ถนนพญาไท เขตราชเทวี กรุงเทพฯ 10400';`;

const newStr = `export default function DeliveryRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [status, setStatus] = useState('ongoing'); // picked_up, ongoing, completed
  const [jobDetails, setJobDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await api.get('/rider/jobs/' + id);
        if (res.data.success) {
          setJobDetails(res.data.data);
        }
      } catch (err) {
        console.error('Fetch job error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchJob();
  }, [id]);

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#2e7d32" style={{marginTop: 50}} /></View>;
  if (!jobDetails) return <View style={styles.container}><Text style={{textAlign: 'center', marginTop: 50}}>ไม่พบข้อมูลงาน</Text></View>;

  const customerName = jobDetails.customer_name || 'ลูกค้า';
  const customerPhone = jobDetails.customer_phone || '-';
  const deliveryAddress = jobDetails.customer_address || '-';`;

content = content.replace(targetStr, newStr);

fs.writeFileSync(path, content);
console.log('Done modifying delivery/[id].tsx');
