setwd("/Users/landryparnell/Desktop/Sports-Stats-and-Analytics/Stupid R Folder Dr. Barker made me use 2")

library(readr)
library(sqldf)

play_by_play_2025 <- read_csv("play_by_play_2025.csv")

filtered <- sqldf("
  SELECT
    play_id, game_id, week, posteam, defteam,
    play_type, yards_gained, game_seconds_remaining,
    wp, score_differential, yardline_100,
    down, ydstogo, qb_hit, sack,
    tackled_for_loss, fumble, wind, temp, desc
  FROM play_by_play_2025
  WHERE play_type <> 'kickoff'
    AND play_type <> 'punt'
    AND play_type IS NOT NULL
")

write.csv(filtered, file = "play_by_play_2025_filtered.csv", row.names = FALSE)

cat("Done!\n")
cat("Rows:", nrow(filtered), "\n")
cat("Teams:", paste(sort(unique(filtered$posteam)), collapse = ", "), "\n")