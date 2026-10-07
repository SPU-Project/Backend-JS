import { z } from "zod";

export const payReceivableSchema = z.object({
  amount: z.coerce.number().positive("Nominal pembayaran harus lebih besar dari 0"),
  method: z.enum(["cash", "transfer", "qris"], {
    errorMap: () => ({ message: "Metode pembayaran harus cash, transfer, atau qris" }),
  }),
  notes: z.string().trim().optional(),
});
