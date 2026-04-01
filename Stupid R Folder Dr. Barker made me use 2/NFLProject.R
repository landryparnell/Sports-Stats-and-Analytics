setwd("/Users/landryparnell/Desktop/Sports-Stats-and-Analytics/Stupid R Folder Dr. Barker made me use 2")

library(readr)
library(sqldf)

play_by_play_2025 <- read_csv("play_by_play_2025.csv")

filtered <- sqldf("
  SELECT
    distinct posteam
  FROM play_by_play_2025
")

View(filtered)

write.csv(filtered, file = "play_by_play_2025_filtered.csv", row.names = FALSE)

cat("Done!\n")
cat("Rows:", nrow(filtered), "\n")
cat("Teams:", paste(sort(unique(filtered$posteam)), collapse = ", "), "\n")