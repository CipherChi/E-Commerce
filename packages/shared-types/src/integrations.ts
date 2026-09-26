/** Phase 2 seams only. Implementations and external calls are intentionally deferred. */
export interface PaymentGatewayClient { initializePayment(input: { amount: number; reference: string }): Promise<never> }
export interface SmsClient { sendSms(input: { to: string; message: string }): Promise<never> }
export interface WhatsAppClient { sendMessage(input: { to: string; message: string }): Promise<never> }
