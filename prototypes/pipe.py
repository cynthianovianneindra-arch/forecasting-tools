import pandas as pd, numpy as np, warnings
warnings.filterwarnings('ignore')
df=pd.read_pickle('sales.pkl')
df=df[df.utj.notna()].copy()
P=lambda s: s.dt.to_period('M')
df['u']=P(df.utj); df['a']=P(df.akad.where(df.akad.notna())) ; df['b']=P(df.batal.where(df.batal.notna()))
utj=pd.read_csv('utj_m.csv',index_col=0,parse_dates=True).iloc[:,0]; utj.index=utj.index.to_period('M')
akad=pd.read_csv('akad_m.csv',index_col=0,parse_dates=True).iloc[:,0]; akad.index=akad.index.to_period('M')
def hazards(T,maxage=18):
    # as-of T: events with month<=T only
    d=df[df.u<=T]
    ha=np.zeros(maxage+1); hb=np.zeros(maxage+1)
    for a in range(maxage+1):
        risk=0;ea=0;eb=0
        for _,r in d.iterrows():
            if r.u+a>T: continue            # age a not observed yet
            ta=(r.a-r.u).n if (pd.notna(r.a) and r.a<=T) else None
            tb=(r.b-r.u).n if (pd.notna(r.b) and r.b<=T) else None
            ev=[x for x in (ta,tb) if x is not None]
            first=min(ev) if ev else None
            if first is not None and first<a: continue   # already left
            risk+=1
            if first==a:
                if ta==a and (tb is None or ta<=tb): ea+=1
                else: eb+=1
        ha[a]=ea/risk if risk>=3 else 0; hb[a]=eb/risk if risk>=3 else 0
    return ha,hb
def predict_akad(T,H,utj_fc):
    ha,hb=hazards(T)
    d=df[df.u<=T]
    out=np.zeros(H)
    # open units
    for _,r in d.iterrows():
        gone=(pd.notna(r.a) and r.a<=T) or (pd.notna(r.b) and r.b<=T)
        if gone: continue
        age=(T-r.u).n; s=1.0
        for k in range(1,H+1):
            a=age+k
            if a>18: break
            out[k-1]+=s*ha[a]; s*=(1-ha[a]-hb[a])
    # future UTJ
    for j in range(1,H+1):
        s=1.0
        for k in range(0,H-j+1):
            out[j+k-1]+=utj_fc[j-1]*s*ha[k]; s*=(1-ha[k]-hb[k])
    return out
H=3; rows=[]
n=len(akad)
for t in range(24,n-H+1):
    T=akad.index[t-1]
    hist_u=utj.iloc[:t]; fc=np.repeat(hist_u.iloc[-12:].mean(),H)
    p=predict_akad(T,H,fc)
    act=akad.iloc[t:t+H].values
    ma=np.repeat(akad.iloc[t-6:t].mean(),H)
    rows.append((np.abs(p-act),abs(p.sum()-act.sum()),np.abs(ma-act),abs(ma.sum()-act.sum())))
a=np.array([r[0] for r in rows]); b=np.array([r[2] for r in rows])
print('PIPELINE akad: MAE1',a[:,0].mean().round(2),'MAE1-3',a.mean().round(2),'MAE total3',np.mean([r[1] for r in rows]).round(2))
print('Rata2 6bln   : MAE1',b[:,0].mean().round(2),'MAE1-3',b.mean().round(2),'MAE total3',np.mean([r[3] for r in rows]).round(2))
ha,hb=hazards(akad.index[-1]); print('hazard akad by age(0..8):',ha[:9].round(2)); print('hazard batal by age:',hb[:9].round(2))
print('cum akad prob',(1-np.prod(1-ha-hb))*0, 'status counts',df.a.notna().sum(),df.b.notna().sum(),len(df))
