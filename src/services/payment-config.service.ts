export interface CodSettings {
  cod_enabled: boolean;
  cod_min_amount: number;
  cod_max_amount: number;
}

class PaymentConfigService {
  private codSettings: CodSettings | null = null;

  setCodSettings(settings: CodSettings | null | undefined) {
    if (!settings) {
      this.codSettings = null;
      return;
    }
    this.codSettings = {
      cod_enabled: Boolean(settings.cod_enabled),
      cod_min_amount: Number(settings.cod_min_amount ?? 0),
      cod_max_amount: Number(
        settings.cod_max_amount ?? Number.MAX_SAFE_INTEGER,
      ),
    };
  }

  getCodSettings(): CodSettings | null {
    return this.codSettings;
  }
}

export const paymentConfigService = new PaymentConfigService();

