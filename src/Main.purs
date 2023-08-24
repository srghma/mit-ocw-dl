module Main where

import Prelude
import Effect (Effect)
import Effect.Console as Console
import Effect.Aff (Aff)
import Data.Tuple

import Options.Applicative
import Options.Applicative as Options.Applicative

type AppOptions =
  { link :: String
  }

appOptions :: Parser AppOptions
appOptions = ado
  link <-
    strOption
      ( long "link"
          <> metavar "FILEPATH"
          <> help "Directory to output or override"
      )
  in { link }

opts :: ParserInfo AppOptions
opts =
  info (appOptions <**> helper)
    ( fullDesc
        <> progDesc "GraphQL API GraphQLClientGenerator"
        <> header "purescript-graphqlclient-generator - generates API modules from GraphQL schemas"
    )

main :: Effect Unit
main = do
  appOptions <- Options.Applicative.execParser opts
  Console.log appOptions.link
  -- Add your logic here using Aff or other effects
