import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const transactionSchema = z.object({
  type: z.enum(['PEMASUKAN', 'PENGELUARAN']),
  category: z.string().min(1, 'Kategori transaksi wajib diisi'),
  accountId: z.string().optional().nullable(),
  description: z.string().min(1, 'Keterangan/deskripsi wajib diisi'),
  amount: z.coerce
    .number()
    .positive('Nominal harus lebih besar dari 0'),
  date: z.string().min(1, 'Tanggal transaksi wajib diisi'),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export const cateringOrderSchema = z.object({
  customerName: z.string().min(1, 'Nama pemesan wajib diisi'),
  customerPhone: z.string().optional().nullable(),
  eventDate: z.string().min(1, 'Tanggal acara wajib diisi'),
  menuDetail: z.string().min(1, 'Detail menu wajib diisi'),
  portion: z.coerce
    .number()
    .int('Porsi harus berupa bilangan bulat')
    .positive('Porsi minimal 1'),
  totalPrice: z.coerce
    .number()
    .positive('Total harga harus lebih besar dari 0'),
  status: z.enum(['PENDING', 'DIPROSES', 'SELESAI', 'DIBATALKAN']).default('PENDING'),
  notes: z.string().optional().nullable(),
});

export type CateringOrderInput = z.infer<typeof cateringOrderSchema>;

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
