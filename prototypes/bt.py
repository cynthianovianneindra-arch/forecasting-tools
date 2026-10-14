import pandas as pd, numpy as np, warnings, openpyxl
warnings.filterwarnings('ignore')
from statsmodels.tsa.holtwinters import ExponentialSmoothing
df=pd.read_pickle('sales.pkl')
idx=pd.period_range('2022-04','2026-07',freq='M')
utj=df.utj.dropna().dt.to_period('M').value_counts().reindex(idx,fill_value=0).sort_index().astype(float)
akad=df.akad.dropna().dt.to_period('M').value_counts().reindex(idx,fill_value=0).sort_index().astype(float)
print('UTJ n=',len(utj),'mean',utj.mean().round(2),'std',utj.std().round(2),' | akad mean',akad.mean().round(2))
print('last12 UTJ',utj[-12:].values.tolist())

# ---- forecasters: f(history Series, h) -> array len h
def f_naive(y,h): return np.repeat(y.iloc[-1],h)
def f_ma(k): return lambda y,h: np.repeat(y.iloc[-k:].mean(),h)
def f_snaive(y,h):
    return np.array([y.iloc[len(y)-12+((i)%12)] for i in range(h)])
def f_excel(y,h):
    # FORECAST.LINEAR on same calendar month across years
    out=[]
    for i in range(1,h+1):
        p=y.index[-1]+i
        same=y[[q for q in y.index if q.month==p.month]]
        if len(same)>=3:
            x=np.array([q.year for q in same.index]); b=np.polyfit(x,same.values,1)
            out.append(max(0,np.polyval(b,p.year)))
        else: out.append(same.mean() if len(same) else y.mean())
    return np.array(out)
def f_ets(y,h):
    try:
        m=ExponentialSmoothing(y.values,trend=None,seasonal=None).fit()
        return np.repeat(m.forecast(h)[0],h)
    except: return f_ma(12)(y,h)
def f_holt(y,h):
    try:
        m=ExponentialSmoothing(y.values,trend='add',damped_trend=True).fit(); return np.maximum(0,m.forecast(h))
    except: return f_ma(12)(y,h)
def f_hw(y,h):
    try:
        m=ExponentialSmoothing(y.values+0.5,trend=None,seasonal='add',seasonal_periods=12).fit(); return np.maximum(0,m.forecast(h)-0.5)
    except: return f_ma(12)(y,h)
def f_blend(y,h): return 0.5*f_ma(12)(y,h)+0.5*f_excel(y,h)
methods={'Naive (bulan lalu)':f_naive,'Rata2 3 bln':f_ma(3),'Rata2 6 bln':f_ma(6),'Rata2 12 bln':f_ma(12),
 'Seasonal naive':f_snaive,'Excel-style (linear per bulan)':f_excel,'Exp. smoothing (level)':f_ets,'Holt damped':f_holt,'Holt-Winters musiman':f_hw}
def backtest(series,H=3,start=24):
    res={m:{'ae':[], 'sum3':[]} for m in methods}
    n=len(series)
    for t in range(start,n-H+1):
        hist=series.iloc[:t]; act=series.iloc[t:t+H].values
        for m,f in methods.items():
            p=f(hist,H); res[m]['ae'].append(np.abs(p-act)); res[m]['sum3'].append(abs(p.sum()-act.sum()))
    rows=[]
    for m,r in res.items():
        ae=np.array(r['ae']); rows.append((m,ae[:,0].mean(),ae.mean(),np.mean(r['sum3'])))
    out=pd.DataFrame(rows,columns=['metode','MAE_1bln','MAE_1-3bln','MAE_total3bln']).sort_values('MAE_1-3bln')
    return out.round(2), n-H+1-start
print('\n=== BACKTEST UTJ ==='); o,k=backtest(utj); print(o.to_string(index=False)); print('origin count',k)
o.to_csv('bt_utj.csv',index=False)
print('\n=== BACKTEST AKAD (direct) ==='); o2,k2=backtest(akad); print(o2.to_string(index=False)); o2.to_csv('bt_akad_direct.csv',index=False)
utj.to_csv('utj_m.csv'); akad.to_csv('akad_m.csv')
