const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'smart-deal-app/src/app/settings.tsx');
let content = fs.readFileSync(settingsPath, 'utf8');

// 1. Remove language states and modal
content = content.replace(/const \[language, setLanguage\] = useState\('ไทย'\);\s*/g, '');
content = content.replace(/const \[showLangModal, setShowLangModal\] = useState\(false\);\s*/g, '');
content = content.replace(/const handleSelectLanguage = \(lang: string\) => \{[\s\S]*?\};\s*/g, '');

// 2. Remove language from loadSettings
content = content.replace(/setLanguage\(parsed\.language \?\? 'ไทย'\);\s*/g, '');

// 3. Update Preferences Section to only have Dark Mode
const oldPrefSection = `{/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>การแสดงผลและภาษา</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name="moon-outline" size={20} color="#8b5cf6" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>โหมดกลางคืน (Dark Mode)</Text>
            <Switch
              value={isDark}
              onValueChange={(val) => handleToggle('darkMode', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity style={styles.row} onPress={() => setShowLangModal(true)}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="language" size={20} color="#06b6d4" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>ภาษา (Language)</Text>
            <Text style={[styles.subText, { color: subTextColor }]}>{language === 'ไทย' ? 'ไทย' : 'English'}</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
        </View>`;

const newPrefSection = `{/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>การแสดงผล</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name="moon-outline" size={20} color="#8b5cf6" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>โหมดกลางคืน (Dark Mode)</Text>
            <Switch
              value={isDark}
              onValueChange={(val) => handleToggle('darkMode', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
        </View>`;

if (content.includes('การแสดงผลและภาษา')) {
  content = content.replace(oldPrefSection, newPrefSection);
}

// 4. Remove Modal 3 (Language Modal)
const langModalRegex = /\{\/\* 3\. Modal เลือกภาษา \*\/\}[\s\S]*?<\/Modal>\s*/m;
content = content.replace(langModalRegex, '');

// 5. Update styles: add flex: 1 to rowText so all Switch components align perfectly on the right
content = content.replace(
  /rowText: \{\s*fontSize: 15,\s*fontWeight: '600',\s*\},/m,
  `rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },`
);

fs.writeFileSync(settingsPath, content, 'utf8');
console.log('✅ Updated settings.tsx: aligned switches to right and removed language feature');
