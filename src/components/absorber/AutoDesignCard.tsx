interface AutoDesignCardProps { freqGhz: number; thrDb: number; }
export default function AutoDesignCard({ freqGhz }: AutoDesignCardProps) {
  return <div role="status" className="rounded-xl border p-5">
    No supported result at {freqGhz.toFixed(3)} GHz. Design and expected performance are unavailable.
    No synthetic curve or unverified literature performance is substituted.
  </div>;
}
