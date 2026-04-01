# Sports-Stats-and-Analytics
Repository for Sports Stats &amp; Analytics

This is a general repository for our NFL Injury Prediction research project.
## The file structure is as follows:

SPORTS-STATS-AND-ANALYTICS/
└── Stupid R Folder Dr. Barker made me use 2/
    └── react-dashboard/
        ├── data/
        │   └── play_by_play_2025_filtered.csv
        ├── public/
        │   └── nflData.json
        ├── src/
        │   ├── dashboard.css
        │   ├── dashboard.jsx
        │   ├── main.jsx
        │   └── nflData.json
        ├── generate_data.py
        ├── index.html
        ├── Player Risk Score Model.py
        ├── risk_engine.py
        ├── vite.config.js
        ├── classification.py
        ├── iteration2.py
        ├── multiplier.py
        ├── NFLProject.R
        ├── play_by_play_2025.csv
        └── README.md

The react-dashboard contains the visualization of Claire's mathematical model which is depicted in `Player Risk Score Model.py` and Landry's machine learning model that output the weighted factors is `iteratiion2.py` with the dashboard function being contained in `risk_engine.py`.

To run the dashboard cd into `react-dashboard` and run `npm run dev` in the terminal after installing all necessary depencies. 
