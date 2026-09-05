import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const businessUnitEnum = z.enum([
  'CATERING',
  'RENTAL_MOLEN',
  'WIFI_DESA',
  'PPOB',
  'KETAHANAN_PANGAN',
  'UMUM',
]);

export const transactionSchema = z.object({
  type: z.enum(['PEMASUKAN', 'PENGELUARAN']),
  category: z.string().min(1, 'Kategori transaksi wajib diisi'),
  businessUnit: businessUnitEnum.default('UMUM').optional(),
  paymentMethod: z.enum(['TUNAI', 'TRANSFER']).default('TUNAI').optional(),
  accountId: z.string().optional().nullable(),
  description: z.string().min(1, 'Keterangan/deskripsi wajib diisi'),
  amount: z.coerce
    .number()
    .positive('Nominal harus lebih besar dari 0'),
  date: z.string().min(1, 'Tanggal transaksi wajib diisi'),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// Catering Order
export const cateringOrderSchema = z.object({
  customerName: z.string().min(2, 'Nama pemesan minimal 2 karakter'),
  customerPhone: z.string().optional().nullable(),
  eventDate: z.string().min(1, 'Tanggal acara wajib diisi'),
  menuDetail: z.string().min(3, 'Rincian menu wajib diisi'),
  portion: z.coerce.number().int().positive('Jumlah porsi minimal 1'),
  totalPrice: z.coerce.number().positive('Total harga harus lebih dari 0'),
  downPayment: z.coerce.number().min(0, 'Uang muka tidak boleh negatif').default(0),
  paymentStatus: z.enum(['BELUM_LUNAS', 'DP', 'LUNAS']).default('BELUM_LUNAS'),
  status: z.enum(['PENDING', 'DIPROSES', 'SELESAI', 'DIBATALKAN']).default('PENDING'),
  notes: z.string().optional().nullable(),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type CateringOrderInput = z.infer<typeof cateringOrderSchema>;

// Molen Unit & Rental
export const molenUnitSchema = z.object({
  code: z.string().min(1, 'Kode molen wajib diisi'),
  name: z.string().min(2, 'Nama/tipe molen wajib diisi'),
  dailyRate: z.coerce.number().positive('Tarif harian harus lebih dari 0'),
  status: z.enum(['TERSEDIA', 'DISEWA', 'PERBAIKAN']).default('TERSEDIA'),
  condition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type MolenUnitInput = z.infer<typeof molenUnitSchema>;

export const molenRentalSchema = z.object({
  unitId: z.string().min(1, 'Pilih unit molen'),
  renterName: z.string().min(2, 'Nama penyewa minimal 2 karakter'),
  renterPhone: z.string().min(6, 'Nomor HP/Telepon penyewa wajib diisi'),
  renterAddress: z.string().optional().nullable(),
  startDate: z.string().min(1, 'Tanggal mulai sewa wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai sewa wajib diisi'),
  totalDays: z.coerce.number().int().positive('Durasi sewa minimal 1 hari'),
  dailyRate: z.coerce.number().positive('Tarif sewa per hari tidak valid'),
  totalPrice: z.coerce.number().positive('Total biaya harus lebih dari 0'),
  deposit: z.coerce.number().min(0).default(0),
  paymentStatus: z.enum(['BELUM_LUNAS', 'DP', 'LUNAS']).default('BELUM_LUNAS'),
  rentalStatus: z.enum(['AKTIF', 'SELESAI', 'DIBATALKAN']).default('AKTIF'),
  notes: z.string().optional().nullable(),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type MolenRentalInput = z.infer<typeof molenRentalSchema>;

// WiFi Balai Desa
export const wifiPlanSchema = z.object({
  name: z.string().min(2, 'Nama paket minimal 2 karakter'),
  speed: z.string().min(1, 'Kecepatan paket wajib diisi'),
  price: z.coerce.number().positive('Tarif bulanan harus lebih dari 0'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type WifiPlanInput = z.infer<typeof wifiPlanSchema>;

export const wifiCustomerSchema = z.object({
  customerNumber: z.string().min(1, 'Nomor pelanggan wajib diisi'),
  name: z.string().min(2, 'Nama pelanggan minimal 2 karakter'),
  phone: z.string().min(6, 'Nomor telepon wajib diisi'),
  address: z.string().min(2, 'Alamat wajib diisi'),
  rtRw: z.string().optional().nullable(),
  planId: z.string().min(1, 'Pilih paket WiFi'),
  isActive: z.boolean().default(true),
  installationDate: z.string().optional(),
});

export type WifiCustomerInput = z.infer<typeof wifiCustomerSchema>;

export const wifiBillCreateSchema = z.object({
  customerId: z.string().min(1, 'Pilih pelanggan'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  amount: z.coerce.number().positive('Nominal tagihan harus lebih dari 0'),
  dueDate: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'),
  notes: z.string().optional().nullable(),
});

export type WifiBillCreateInput = z.infer<typeof wifiBillCreateSchema>;

export const wifiPaymentSchema = z.object({
  billId: z.string().min(1, 'ID Tagihan wajib disertakan'),
  paidDate: z.string().optional(),
  paymentMethod: z.enum(['TUNAI', 'TRANSFER']).default('TUNAI'),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type WifiPaymentInput = z.infer<typeof wifiPaymentSchema>;

// PPOB
export const ppobTransactionSchema = z.object({
  type: z.enum([
    'PLN_TOKEN',
    'PLN_TAGIHAN',
    'PULSA_DATA',
    'BPJS',
    'PDAM',
    'TRANSFER_BANK',
    'E_WALLET',
    'LAINNYA',
  ]),
  targetNumber: z.string().min(3, 'Nomor tujuan/meteran/rekening wajib diisi'),
  customerName: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0, 'Harga modal minimal 0'),
  sellingPrice: z.coerce.number().positive('Harga jual harus lebih dari 0'),
  status: z.enum(['SUKSES', 'PENDING', 'GAGAL']).default('SUKSES'),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type PpobTransactionInput = z.infer<typeof ppobTransactionSchema>;

// Ketahanan Pangan (Ternak Sapi)
export const cattleSchema = z.object({
  tagNumber: z.string().min(1, 'Nomor Eartag/ID Sapi wajib diisi'),
  name: z.string().optional().nullable(),
  breed: z.string().min(2, 'Jenis/Ras sapi wajib diisi'),
  gender: z.enum(['JANTAN', 'BETINA']).default('JANTAN'),
  status: z.enum(['PENGGEMUKAN', 'BIBIT', 'INDUK', 'SIAP_JUAL', 'TERJUAL', 'MATI']).default('PENGGEMUKAN'),
  purchaseDate: z.string().min(1, 'Tanggal pembelian bibit wajib diisi'),
  purchasePrice: z.coerce.number().min(0, 'Harga beli bibit minimal 0'),
  initialWeight: z.coerce.number().positive('Bobot awal harus lebih dari 0'),
  currentWeight: z.coerce.number().positive('Bobot saat ini harus lebih dari 0'),
  notes: z.string().optional().nullable(),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type CattleInput = z.infer<typeof cattleSchema>;

export const cattleWeightUpdateSchema = z.object({
  weight: z.coerce.number().positive('Bobot harus lebih dari 0'),
  date: z.string().optional(),
});

export const cattleSaleSchema = z.object({
  saleDate: z.string().min(1, 'Tanggal penjualan wajib diisi'),
  salePrice: z.coerce.number().positive('Harga penjualan harus lebih dari 0'),
  buyerName: z.string().min(2, 'Nama pembeli wajib diisi'),
  notes: z.string().optional().nullable(),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type CattleSaleInput = z.infer<typeof cattleSaleSchema>;

export const cattleExpenseSchema = z.object({
  cattleId: z.string().optional().nullable(),
  type: z.enum(['PAKAN', 'VAKSIN_OBAT', 'PERAWATAN_KANDANG', 'UPAH_PEKERJA', 'LAINNYA']),
  description: z.string().min(2, 'Keterangan biaya wajib diisi'),
  amount: z.coerce.number().positive('Nominal biaya harus lebih dari 0'),
  date: z.string().min(1, 'Tanggal pengeluaran wajib diisi'),
  syncToTransaction: z.boolean().default(true).optional(),
});

export type CattleExpenseInput = z.infer<typeof cattleExpenseSchema>;

// User
export const userCreateSchema = z.object({
  name: z.string().min(2, 'Nama pengguna minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  isActive: z.boolean().default(true),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().min(2, 'Nama pengguna minimal 2 karakter').optional(),
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter').optional().or(z.literal('')),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
