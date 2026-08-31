# binalab SaaS — נקודת המשכיות (נכתב 31.8.2026)

מסמך זה מיועד לכל סשן Claude שממשיך את הפרויקט — מכל חשבון. לקרוא לפני כל עבודה.

## מה המוצר
binalab: CRM אג'נטי כ-SaaS מולטי-טננטי. הגוף: fork של Twenty (github.com/binalab-ai/twenty). המוח: "המנוע" — שירות נפרד וסגור (יורש ה-launchpad של NEXUS) שמאזין ל-webhooks של Twenty ומפעיל לולאות תגובה (policy engine + LLM), כותב חזרה דרך ה-API.

## מסמך האפיון המלא
docs/nexus2-spec.html בתיקייה זו — כל ההכרעות (1–9), הישויות, מכונות המצבים (משפך: ליד חדש→יצירת קשר→פגישה נקבעה→אפיון→הצעה נשלחה→משא ומתן→Won/Lost), תוכנית שלב א' (A-00…A-07), ממצאי הריוורס-אנג'ינירינג של Attio ופיילוט Twenty שעבר.

## סטטוס A-00…A-07 (נכון לכתיבה)
- A-00 חשבונות — כמעט הושלם: ארגון GitHub ‏binalab-ai + fork ‏twenty ✓ · חשבון Railway (Trial, מקושר GitHub) ✓ · GCP פרויקט binalab-app עם OAuth client ‏binalab-web (Testing mode; ה-Secret אצל אלי) ✓ · נותרו: SMTP, מפתח LLM (בשלב החיווט).
- A-01 מיתוג — בוצע כשני קומיטים, ממתינים ב-binalab-patches/ (0001, 0002): שם binalab בכל הממשק/מיילים/manifest, 112 אייקוני placeholder (ריבוע כהה + b), לוגו מוגש לוקאלית. להחיל: git am בתוך ה-clone של ה-fork ולדחוף. לוגו אמיתי של binalab — עדיין חסר, להחליף כשאלי מספק.
- A-02 פריסה ל-Railway — טרם החל. נבדק שהכול נתמך (שירותים מרובים, רשת פנימית, PG/Redis מנוהלים, volumes, dockerfile path מותאם, דומיין). דומיין היעד: app.binalab.ai (DNS ב-GoDaddy, CNAME כשתהיה כתובת).
- A-03 סוויטת עברית — טרם החלה (חיפוש/פתקים/סינון בעברית ב-Twenty).
- A-04 התאמת מודל (קונפיגורציית Data model לפי ההכרעות) · A-05 מנוע מרובה-דיירים · A-06 onboarding · A-07 פיילוט realnumbers — טרם החלו.
- פתוח: תמחור.

## פיילוט Twenty שהוכיח הכול (30.8, בקונטיינר ענן)
המערכת הורמה מלאה; עברית-כתוכן עובדת (RTL-פריסה אין — נדחה, ממשק אנגלית הוחלט); לולאת התגובה חיה: שינוי שלב→webhook (עם updatedFields)→מאזין→משימת מעקב בעברית חזרה דרך REST→הגנת לולאה לפי actor. בונוסים: סכימת Postgres נפרדת פר-workspace; תור עמיד; מסך Data model=ניהול ישויות. הערות טכניות: worker חובה ל-webhooks (yarn worker:prod); ‏OUTBOUND_HTTP_SAFE_MODE_ENABLED=false נדרש ליעדים פנימיים בפיתוח; Node ‏24 נדרש (בפיילוט נעקף); סקריפט מאזין-דמה שמור בענן: hook-listener.mjs.

## רישוי (קריטי)
Twenty = AGPL-3.0 + חריג מפורש: אפליקציות דרך API/webhooks/SDK מותרות בקוד קנייני ("Twenty Application Exception"). ה-fork פתוח (מיתוג/תיקונים); המנוע נשאר סגור כשירות נפרד. אסור להשתמש בקבצי @license Enterprise ובשם Twenty לשיווק. חינם לחלוטין.

## מבנה התיקייה
binalab-saas/twenty — clone של ה-fork · binalab-patches/ — קומיטים ממתינים · docs/ — אפיון + מסמך זה · (עתידי) engine/ — רפו המנוע הפרטי.

## הקשר העסקי
לקוח ראשון מיועד: realnumbers.co.il (ניהול פיננסי לסטארטאפים; פגישת מכירה נערכה 30.8). מה שחשוב להם: ניהול תהליך ליד מלא. אלי מנהל את הקצב — לשאול אותו, שלב-שלב. שפות: ממשק אנגלית; עברית-כתוכן חובה מלאה.
המערכת הישנה (NEXUS 1.0, ‏Airtable+Drive, רפו ‏~/Documents/ana/nexus, ‏main) נשארת קו הדמו עד ששלב א' באוויר.

## עדכון 31.8 צהריים — A-00 ו-A-01 הושלמו
- המיתוג נדחף ל-main של binalab-ai/twenty (a9b2ab4). ה-clone המקומי: binalab-saas/twenty.
- הטרמינל של אלי מזדהה עכשיו כ-elianatali (דרך gh auth login) — יש הרשאת דחיפה.
- בחשבון ה-Claude Team של binalab (eli@binalab.ai): אפליקציית GitHub מחוברת ל-binalab-ai + elianatali; קונקטור Railway מחובר (OAuth הצליח).
- ההחלטה: העבודה על המוצר עוברת לסשנים בחשבון ה-Team של binalab. סשן חדש שם מתחיל מקריאת התיקייה הזאת (docs/HANDOFF.md + docs/nexus2-spec.html).
- הבא בתור: A-02 פריסה ל-Railway (דרך הקונקטור, מסשן Team) · A-03 סוויטת עברית · לוגו אמיתי מאלי.
