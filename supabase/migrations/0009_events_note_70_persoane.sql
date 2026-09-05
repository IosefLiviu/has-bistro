-- Mesele festive se ţin acum pentru până la 70 de persoane, nu 30.
-- Valoarea iniţială a fost pusă de 0002; migraţia aia rămâne cum a fost,
-- ca să reflecte ce s-a aplicat atunci.

update public.settings
set value = jsonb_set(
      value,
      '{events_note}',
      to_jsonb('Organizăm evenimente și mese festive — maximum 70 persoane.'::text)
    )
where key = 'restaurant';
