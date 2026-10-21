

export class StockMovementDto {
   productId!: string;
     quantity!: number;
     reason?: string;
}
export class StockAdjustmentDto {
   productId!: string;
    quantity!: number;
    reason!: string;
}
export class MovementQueryDto {
    type?: string;
    from?: string;
    to?: string;
      page = 1;
      limit = 20;
}
