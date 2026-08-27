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
