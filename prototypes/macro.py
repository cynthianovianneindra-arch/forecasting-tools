import pandas as pd, numpy as np, openpyxl, warnings
warnings.filterwarnings('ignore')
from sklearn.linear_model import Ridge
wv=openpyxl.load_workbook('/root/.claude/uploads/f6e86249-a271-5087-9463-00086719aba1/8674954a-FORECASTING_UPDATE.xlsx',data_only=True,read_only=True)
ws=wv['INSTRUMEN EKONOMI']
rows=[r for r in ws.iter_rows(min_row=4,max_row=60,min_col=16,max_col=26,values_only=True) if r[0] is not None]
m=pd.DataFrame(rows,columns=['bulan','emas','ihsg','inflasi','ihpr','umr','umk_sby','umk_sda','nikah','lahir','birate'])
m['bulan']=pd.to_datetime(m.bulan,errors='coerce'); m=m.dropna(subset=['bulan']); m.index=m.bulan.dt.to_period('M')
for c in m.columns[1:]: m[c]=pd.to_numeric(m[c],errors='coerce')
print(m[['emas','ihsg','inflasi','birate']].describe().loc[['count','min','max']].round(2))
utj=pd.read_csv('utj_m.csv',index_col=0,parse_dates=True).iloc[:,0]; utj.index=utj.index.to_period('M')
feats=['emas','ihsg','inflasi','birate']
X=m[feats].shift(1)   # known 1 month earlier
X=X.pct_change() if False else X
d=pd.concat([utj.rename('y'),X],axis=1).dropna()
print('rows',len(d), d.index[0],d.index[-1])
def run(cols):
    e=[];e0=[]
    for t in range(24,len(d)):
        tr=d.iloc[:t]; te=d.iloc[t]
        mu=tr[cols].mean();sd=tr[cols].std().replace(0,1)
        mdl=Ridge(alpha=10).fit(((tr[cols]-mu)/sd).values,tr.y.values)
        p=mdl.predict(((te[cols]-mu)/sd).values.reshape(1,-1))[0]
        e.append(abs(max(0,p)-te.y)); e0.append(abs(tr.y.iloc[-12:].mean()-te.y))
    return np.mean(e),np.mean(e0),len(e)
for cols in (['ihsg'],['emas'],['birate'],['inflasi'],feats):
    a,b,n=run(cols); print(cols,'MAE regresi makro',round(a,2),'vs rata2 12bln',round(b,2),'n',n)
