import pandas as pd, numpy as np, warnings
warnings.filterwarnings('ignore')
from sklearn.linear_model import LinearRegression
exec(open('bt.py').read().split("# ---- forecasters")[0].split("df=pd.read_pickle")[0])
for name in ['utj','akad']:
    y=pd.read_csv(name+'_m.csv',index_col=0)['count']; y.index=pd.PeriodIndex(y.index,freq='M')
    def lr_trend(k):
        def f(h_,H):
            w=h_.iloc[-k:] if k else h_
            X=np.arange(len(w)).reshape(-1,1); m=LinearRegression().fit(X,w.values)
            return np.maximum(0,m.predict(np.arange(len(w),len(w)+H).reshape(-1,1)))
        return f
    def lr_lag(h_,H):  # recursive, features: t, lag1, lag2, month-of-year not used
        v=list(h_.values); 
        X=np.array([[i,v[i-1],v[i-2]] for i in range(2,len(v))]); Y=np.array(v[2:])
        m=LinearRegression().fit(X,Y); out=[]
        for s in range(H):
            i=len(v); p=max(0,m.predict([[i,v[-1],v[-2]]])[0]); out.append(p); v.append(p)
        return np.array(out)
    ma12=lambda h_,H: np.repeat(h_.iloc[-12:].mean(),H)
    meths={'Rata2 12 bln':ma12,'LinReg tren (semua data)':lr_trend(0),'LinReg tren (24 bln)':lr_trend(24),'LinReg tren (12 bln)':lr_trend(12),'LinReg tren+lag1,2':lr_lag}
    H=3; res={m:[] for m in meths}
    for t in range(24,len(y)-H+1):
        a=y.iloc[t:t+H].values
        for m,f in meths.items(): res[m].append(np.abs(f(y.iloc[:t],H)-a))
    print(name.upper(),'origins',len(res['Rata2 12 bln']))
    for m,r in res.items(): r=np.array(r); print(f'  {m:28s} MAE 1bln {r[:,0].mean():.2f}  MAE 1-3bln {r.mean():.2f}')
