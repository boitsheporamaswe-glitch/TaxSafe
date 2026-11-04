const fmt = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
export const grp = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 });
export const money = n => fmt.format(n || 0);
export const day = t => new Date(t).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
export const longDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
