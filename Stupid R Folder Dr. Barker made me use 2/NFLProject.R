library(readr)
play_by_play_2025 <- read_csv("play_by_play_2025.csv")
View(play_by_play_2025)

install.packages("sqldf")
library(sqldf)

KC <- sqldf("SELECT home_team, away_team, week, posteam, defteam, game_date, quarter_seconds_remaining, desc, play_type
                 FROM play_by_play_2025 
                 where home_team = 'KC'
                 and play_type <> 'kickoff'
                  and play_type <> 'punt'
        ")

WAS <- sqldf("SELECT home_team, away_team, week, posteam, defteam, game_date, quarter_seconds_remaining, desc, play_type
                 FROM play_by_play_2025 
                 where home_team = 'WAS'
                  and play_type <> 'kickoff'
                  and play_type <> 'punt'")




View(KC)
View(WAS)

write.csv(WAS, file = "WAS.csv")