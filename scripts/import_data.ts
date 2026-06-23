import fs from 'fs';
import { db } from '../src/db/index';
import { clients } from '../src/db/schema';

const csv = fs.readFileSync('/Users/macbookairm4/.gemini/antigravity/brain/dab3c934-7cdf-476d-831a-06773600f745/.system_generated/steps/69/content.md', 'utf-8');

const lines = csv.split('\n');

const parseAmount = (str: string) => {
    if (!str || str === '-') return 0;
    const match = str.replace(/\./g, '').match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
};

const parseDate = (str: string) => {
    if (!str || str === '-') return new Date().toISOString().split('T')[0];
    const parts = str.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (str.includes(' ')) {
        // Handle stuff like "27 Şubat 2025"
        const p = str.split(' ');
        if (p.length === 3) {
            const months: any = {
                'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04', 'Mayıs': '05', 'Haziran': '06',
                'Temmuz': '07', 'Ağustos': '08', 'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
            };
            return `${p[2]}-${months[p[1]] || '01'}-${p[0].padStart(2, '0')}`;
        }
    }
    return new Date().toISOString().split('T')[0];
};

const getPaymentDay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) return parseInt(parts[2]);
    return 1;
};

async function run() {
    let started = false;
    for (const line of lines) {
        if (line.startsWith(',,Marka')) {
            started = true;
            continue;
        }
        if (!started) continue;
        if (!line.trim() || line.trim() === ',,,,,,,') continue;
        
        const cols = line.split(',');
        // Some lines might have extra commas if the name has commas. Assuming simple CSV without quotes for now.
        // Actually, looking at the data, it's pretty flat.
        
        const source = cols[1]?.trim() || 'Referans';
        const name = cols[2]?.trim();
        if (!name) continue;
        
        const domain = cols[3]?.trim();
        const agreementDateRaw = cols[4]?.trim();
        const startDateRaw = cols[6]?.trim();
        const amountRaw = cols[7]?.trim();
        
        const agreedAmount = parseAmount(amountRaw);
        const agreementDate = parseDate(agreementDateRaw || startDateRaw);
        const startDate = parseDate(startDateRaw || agreementDateRaw);
        const paymentDay = getPaymentDay(startDate);
        const projectName = domain ? domain : 'Hizmet / Proje';
        
        console.log(`Inserting: ${name} - ${agreedAmount} TRY - ${startDate}`);
        
        await db.insert(clients).values({
            name,
            projectName,
            agreedAmount,
            currency: 'TRY',
            paymentDay,
            paymentType: 'upfront',
            accountInfo: 'Banka Hesabı',
            status: 'aktif',
            agreementDate,
            startDate,
            source,
            gracePeriodDays: 5
        });
    }
    console.log("Veriler başarıyla eklendi.");
}

run().catch(console.error);
