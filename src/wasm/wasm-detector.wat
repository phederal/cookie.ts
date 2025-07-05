(module
  (memory (export "memory") 4)

  ;; Быстрая детекция формата cookie с исправленной логикой и bounds checking
  (func $detectFormat (param $ptr i32) (param $len i32) (result i32)
    (local $firstChar i32)
    (local $lastChar i32)
    (local $i i32)
    (local $equalCount i32)
    (local $tabCount i32)
    (local $spaceGroupCount i32)
    (local $semicolonCount i32)
    (local $char i32)
    (local $fieldCount i32)
    (local $inField i32)
    (local $inWhitespace i32)
    (local $firstEqualPos i32)
    (local $cookieNameValid i32)
    (local $booleanFieldsFound i32)
    (local $j i32)
    (local $nameEnd i32)
    (local $nameChar i32)
    (local $consecutiveSpaces i32)

    ;; Проверка на пустую строку и максимальный размер
    (if (i32.or
          (i32.eq (local.get $len) (i32.const 0))
          (i32.gt_u (local.get $len) (i32.const 65536))
        )
      (then (return (i32.const 0)))
    )

	;; Защита от слишком длинных строк (>32KB)
    (if (i32.gt_u (local.get $len) (i32.const 32768))
      (then (return (i32.const 0)))
    )

    ;; Получаем первый символ
    (local.set $firstChar (i32.load8_u (local.get $ptr)))

    ;; Комментарии (кроме #HttpOnly_)
    (if (i32.eq (local.get $firstChar) (i32.const 35)) ;; '#'
      (then
        ;; Проверяем #HttpOnly_ префикс
        (if (i32.and
              (i32.ge_u (local.get $len) (i32.const 10))
              (i32.and
                (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.const 1))) (i32.const 72)) ;; 'H'
                (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.const 8))) (i32.const 121)) ;; 'y'
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.const 9))) (i32.const 95)) ;; '_'
                )
              )
            )
          (then
            ;; Убираем #HttpOnly_ префикс
            (local.set $ptr (i32.add (local.get $ptr) (i32.const 10)))
            (local.set $len (i32.sub (local.get $len) (i32.const 10)))
            (if (i32.eq (local.get $len) (i32.const 0))
              (then (return (i32.const 0)))
            )
            (local.set $firstChar (i32.load8_u (local.get $ptr)))
          )
          (else
            ;; Обычный комментарий
            (return (i32.const 0))
          )
        )
      )
    )

    ;; Обновляем последний символ
    (if (i32.gt_u (local.get $len) (i32.const 0))
      (then
        (local.set $lastChar (i32.load8_u (i32.add (local.get $ptr) (i32.sub (local.get $len) (i32.const 1)))))
      )
      (else
        (return (i32.const 0))
      )
    )

    ;; JSON: строгая проверка { } или [ ]
    (if (i32.eq (local.get $firstChar) (i32.const 123)) ;; '{'
      (then
        (if (i32.eq (local.get $lastChar) (i32.const 125)) ;; '}'
          (then (return (i32.const 1))) ;; JSON
        )
      )
    )
    (if (i32.eq (local.get $firstChar) (i32.const 91)) ;; '['
      (then
        (if (i32.eq (local.get $lastChar) (i32.const 93)) ;; ']'
          (then (return (i32.const 1))) ;; JSON
        )
      )
    )

    ;; Инициализация счетчиков
    (local.set $i (i32.const 0))
    (local.set $equalCount (i32.const 0))
    (local.set $tabCount (i32.const 0))
    (local.set $spaceGroupCount (i32.const 0))
    (local.set $semicolonCount (i32.const 0))
    (local.set $fieldCount (i32.const 1)) ;; начинаем с 1 поля
    (local.set $inWhitespace (i32.const 0))
    (local.set $firstEqualPos (i32.const -1))
    (local.set $booleanFieldsFound (i32.const 0))
    (local.set $consecutiveSpaces (i32.const 0))

    ;; Оптимизированное сканирование для длинных строк
    ;; Ограничиваем анализ первыми 1000 символами для производительности
    ;; (local.set $len (call $min (local.get $len) (i32.const 1000)))

    ;; Сканирование строки для подсчета структуры с bounds checking
    (block $scan_done
      (loop $scan_loop
        (br_if $scan_done (i32.ge_u (local.get $i) (local.get $len)))

        (local.set $char (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))

        ;; Обработка whitespace и подсчет полей с улучшенной логикой
        (if (i32.eq (local.get $char) (i32.const 9)) ;; '\t'
          (then
            (local.set $tabCount (i32.add (local.get $tabCount) (i32.const 1)))
            (if (i32.eqz (local.get $inWhitespace))
              (then (local.set $fieldCount (i32.add (local.get $fieldCount) (i32.const 1))))
            )
            (local.set $inWhitespace (i32.const 1))
            (local.set $consecutiveSpaces (i32.const 0))
          )
          (else
            (if (i32.eq (local.get $char) (i32.const 32)) ;; ' '
              (then
                (local.set $consecutiveSpaces (i32.add (local.get $consecutiveSpaces) (i32.const 1)))
                (if (i32.eqz (local.get $inWhitespace))
                  (then
                    (local.set $spaceGroupCount (i32.add (local.get $spaceGroupCount) (i32.const 1)))
                    (local.set $fieldCount (i32.add (local.get $fieldCount) (i32.const 1)))
                  )
                )
                (local.set $inWhitespace (i32.const 1))
              )
              (else
                ;; Корректируем fieldCount для множественных пробелов
                (if (i32.and
                      (i32.gt_u (local.get $consecutiveSpaces) (i32.const 1))
                      (local.get $inWhitespace)
                    )
                  (then
                    (local.set $fieldCount (i32.sub (local.get $fieldCount) (i32.sub (local.get $consecutiveSpaces) (i32.const 1))))
                  )
                )
                (local.set $consecutiveSpaces (i32.const 0))
                (local.set $inWhitespace (i32.const 0))

                ;; Подсчет специальных символов
                (if (i32.eq (local.get $char) (i32.const 61)) ;; '='
                  (then
                    (local.set $equalCount (i32.add (local.get $equalCount) (i32.const 1)))
                    (if (i32.eq (local.get $firstEqualPos) (i32.const -1))
                      (then (local.set $firstEqualPos (local.get $i)))
                    )
                  )
                )
                (if (i32.eq (local.get $char) (i32.const 59)) ;; ';'
                  (then (local.set $semicolonCount (i32.add (local.get $semicolonCount) (i32.const 1))))
                )
              )
            )
          )
        )

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan_loop)
      )
    )

    ;; Проверка на валидное имя cookie с bounds checking
    (local.set $cookieNameValid (i32.const 0))
    (if (i32.and
          (i32.gt_s (local.get $firstEqualPos) (i32.const 0))
          (i32.gt_u (local.get $equalCount) (i32.const 0))
        )
      (then
        ;; Находим конец имени cookie (убираем trailing whitespace)
        (local.set $nameEnd (local.get $firstEqualPos))
        (block $name_trim_done
          (loop $name_trim_loop
            (br_if $name_trim_done (i32.le_s (local.get $nameEnd) (i32.const 0)))

            (local.set $nameChar (i32.load8_u (i32.add (local.get $ptr) (i32.sub (local.get $nameEnd) (i32.const 1)))))
            (if (i32.and
                  (i32.ne (local.get $nameChar) (i32.const 32)) ;; не пробел
                  (i32.ne (local.get $nameChar) (i32.const 9))  ;; не таб
                )
              (then (br $name_trim_done))
            )

            (local.set $nameEnd (i32.sub (local.get $nameEnd) (i32.const 1)))
            (br $name_trim_loop)
          )
        )

        ;; Проверяем что имя не пустое и содержит валидные символы
        (if (i32.gt_s (local.get $nameEnd) (i32.const 0))
          (then
            (local.set $cookieNameValid (i32.const 1))
            ;; Быстрая проверка на валидные символы (ASCII 33-126, кроме =;)
            (local.set $j (i32.const 0))
            (block $name_check_done
              (loop $name_check_loop
                (br_if $name_check_done (i32.ge_s (local.get $j) (local.get $nameEnd)))

                (local.set $nameChar (i32.load8_u (i32.add (local.get $ptr) (local.get $j))))
                ;; Пропускаем leading whitespace
                (if (i32.and
                      (i32.ne (local.get $nameChar) (i32.const 32))
                      (i32.ne (local.get $nameChar) (i32.const 9))
                    )
                  (then
                    ;; Проверяем валидность символа
                    (if (i32.or
                          (i32.lt_u (local.get $nameChar) (i32.const 33))
                          (i32.or
                            (i32.eq (local.get $nameChar) (i32.const 59)) ;; ';'
                            (i32.eq (local.get $nameChar) (i32.const 61)) ;; '='
                          )
                        )
                      (then
                        (local.set $cookieNameValid (i32.const 0))
                        (br $name_check_done)
                      )
                    )
                  )
                )

                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $name_check_loop)
              )
            )
          )
        )
      )
    )

    ;; Проверка на Netscape boolean pattern (улучшенная проверка TRUE/FALSE)
    (if (i32.ge_u (local.get $fieldCount) (i32.const 4))
      (then
        ;; Ищем паттерн TRUE или FALSE в строке с early exit
        (local.set $i (i32.const 0))
        (block $bool_search_done
          (loop $bool_search_loop
            (br_if $bool_search_done (i32.ge_u (local.get $i) (i32.sub (local.get $len) (i32.const 3))))

            (local.set $char (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
            ;; Ищем 'T' для TRUE или 'F' для FALSE
            (if (i32.or
                  (i32.eq (local.get $char) (i32.const 84)) ;; 'T'
                  (i32.eq (local.get $char) (i32.const 70)) ;; 'F'
                )
              (then
                ;; Проверяем что это начало слова (bounds checking)
                (if (i32.or
                      (i32.eq (local.get $i) (i32.const 0))
                      (i32.and
                        (i32.gt_u (local.get $i) (i32.const 0))
                        (i32.or
                          (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.sub (local.get $i) (i32.const 1)))) (i32.const 32))
                          (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.sub (local.get $i) (i32.const 1)))) (i32.const 9))
                        )
                      )
                    )
                  (then
                    (local.set $booleanFieldsFound (i32.const 1))
                    (br $bool_search_done) ;; Early exit
                  )
                )
              )
            )

            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $bool_search_loop)
          )
        )
      )
    )

    ;; Логика определения формата

    ;; 1. Netscape: точно 7 полей + достаточно разделителей + boolean pattern
    (if (i32.and
          (i32.eq (local.get $fieldCount) (i32.const 7))
          (i32.and
            (i32.ge_u (i32.add (local.get $tabCount) (local.get $spaceGroupCount)) (i32.const 6))
            (local.get $booleanFieldsFound)
          )
        )
      (then (return (i32.const 2))) ;; NETSCAPE
    )

    ;; 2. SetCookie: валидное имя + не Netscape pattern + не множественные cookies
    (if (i32.and
          (local.get $cookieNameValid)
          (i32.gt_u (local.get $equalCount) (i32.const 0))
        )
      (then
        ;; Исключаем множественные cookies (более 1 равно + точка с запятой)
        (if (i32.and
              (i32.gt_u (local.get $equalCount) (i32.const 1))
              (i32.gt_u (local.get $semicolonCount) (i32.const 0))
            )
          (then
            ;; Проверяем наличие дополнительных name=value пар
            (if (call $hasMultipleCookies (local.get $ptr) (local.get $len) (local.get $firstEqualPos))
              (then (return (i32.const 0))) ;; Отклоняем множественные cookies
            )
          )
        )

        ;; Проверяем что это НЕ Netscape (меньше полей или нет boolean pattern)
        (if (i32.or
              (i32.lt_u (local.get $fieldCount) (i32.const 5))
              (i32.eqz (local.get $booleanFieldsFound))
            )
          (then (return (i32.const 3))) ;; SETCOOKIE
        )
      )
    )

    ;; По умолчанию - неизвестный формат
    (return (i32.const 0))
  )

  ;; Вспомогательная функция: минимум из двух значений
  (func $min (param $a i32) (param $b i32) (result i32)
    (if (result i32) (i32.lt_u (local.get $a) (local.get $b))
      (then (local.get $a))
      (else (local.get $b))
    )
  )

  ;; Функция для проверки множественных cookies с полной валидацией атрибутов
  (func $hasMultipleCookies (param $ptr i32) (param $len i32) (param $firstEqualPos i32) (result i32)
    (local $i i32)
    (local $char i32)
    (local $inSemicolon i32)
    (local $wordStart i32)
    (local $wordLen i32)
    (local $isKnownAttr i32)

    ;; Bounds checking
    (if (i32.or
          (i32.ge_s (local.get $firstEqualPos) (local.get $len))
          (i32.lt_s (local.get $firstEqualPos) (i32.const 0))
        )
      (then (return (i32.const 0)))
    )

    ;; Ищем точки с запятой после первого =
    (local.set $i (i32.add (local.get $firstEqualPos) (i32.const 1)))
    (local.set $inSemicolon (i32.const 0))

    (block $check_done
      (loop $check_loop
        (br_if $check_done (i32.ge_u (local.get $i) (local.get $len)))

        (local.set $char (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))

        (if (i32.eq (local.get $char) (i32.const 59)) ;; ';'
          (then (local.set $inSemicolon (i32.const 1)))
        )

        ;; Если нашли = после ;
        (if (i32.and (local.get $inSemicolon) (i32.eq (local.get $char) (i32.const 61)))
          (then
            ;; Находим начало слова перед = с bounds checking
            (local.set $wordStart (local.get $i))
            (block $word_start_done
              (loop $word_start_loop
                ;; Улучшенная проверка границ
                (br_if $word_start_done (i32.or
                  (i32.le_s (local.get $wordStart) (local.get $firstEqualPos))
                  (i32.eq (local.get $wordStart) (i32.const 0))
                ))

                (local.set $wordStart (i32.sub (local.get $wordStart) (i32.const 1)))
                (local.set $char (i32.load8_u (i32.add (local.get $ptr) (local.get $wordStart))))
                (if (i32.or
                      (i32.eq (local.get $char) (i32.const 32)) ;; ' '
                      (i32.eq (local.get $char) (i32.const 59)) ;; ';'
                    )
                  (then
                    (local.set $wordStart (i32.add (local.get $wordStart) (i32.const 1)))
                    (br $word_start_done)
                  )
                )
                (br $word_start_loop)
              )
            )

            ;; Вычисляем длину слова
            (local.set $wordLen (i32.sub (local.get $i) (local.get $wordStart)))

            ;; Проверяем известные атрибуты с полной валидацией
            (local.set $isKnownAttr (call $validateKnownAttribute (local.get $ptr) (local.get $wordStart) (local.get $wordLen)))

            ;; Если это не известный атрибут - множественный cookie
            (if (i32.eqz (local.get $isKnownAttr))
              (then (return (i32.const 1)))
            )
          )
        )

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $check_loop)
      )
    )

    (return (i32.const 0))
  )

  ;; Функция для полной валидации известных атрибутов
  (func $validateKnownAttribute (param $ptr i32) (param $start i32) (param $len i32) (result i32)
    ;; Domain (6 символов)
    (if (i32.eq (local.get $len) (i32.const 6))
      (then
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.or ;; D|d
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 68))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 100))
                  )
                  (i32.or ;; o|O
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 111))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 79))
                  )
                )
                (i32.and
                  (i32.or ;; m|M
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 109))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 77))
                  )
                  (i32.or ;; a|A
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 97))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 65))
                  )
                )
              )
              (i32.and
                (i32.or ;; i|I
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 105))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 73))
                )
                (i32.or ;; n|N
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 110))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 78))
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; Path (4 символа)
    (if (i32.eq (local.get $len) (i32.const 4))
      (then
        (if (i32.and
              (i32.and
                (i32.or ;; P|p
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 80))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 112))
                )
                (i32.or ;; a|A
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 97))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 65))
                )
              )
              (i32.and
                (i32.or ;; t|T
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 116))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 84))
                )
                (i32.or ;; h|H
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 104))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 72))
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; Expires (7 символов)
    (if (i32.eq (local.get $len) (i32.const 7))
      (then
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.or ;; E|e
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 69))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 101))
                  )
                  (i32.or ;; x|X
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 120))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 88))
                  )
                )
                (i32.and
                  (i32.or ;; p|P
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 112))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 80))
                  )
                  (i32.or ;; i|I
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 105))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 73))
                  )
                )
              )
              (i32.and
                (i32.and
                  (i32.or ;; r|R
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 114))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 82))
                  )
                  (i32.or ;; e|E
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 101))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 69))
                  )
                )
                (i32.or ;; s|S
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 115))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 83))
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; Secure (6 символов)
    (if (i32.eq (local.get $len) (i32.const 6))
      (then
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.or ;; S|s
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 83))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 115))
                  )
                  (i32.or ;; e|E
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 101))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 69))
                  )
                )
                (i32.and
                  (i32.or ;; c|C
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 99))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 67))
                  )
                  (i32.or ;; u|U
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 117))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 85))
                  )
                )
              )
              (i32.and
                (i32.or ;; r|R
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 114))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 82))
                )
                (i32.or ;; e|E
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 101))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 69))
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; Max-Age (7 символов, но ищем только Max без дефиса)
    (if (i32.eq (local.get $len) (i32.const 7))
      (then
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.or ;; M|m
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 77))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 109))
                  )
                  (i32.or ;; a|A
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 97))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 65))
                  )
                )
                (i32.and
                  (i32.or ;; x|X
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 120))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 88))
                  )
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 45)) ;; '-'
                )
              )
              (i32.and
                (i32.and
                  (i32.or ;; A|a
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 65))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 97))
                  )
                  (i32.or ;; g|G
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 103))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 71))
                  )
                )
                (i32.or ;; e|E
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 101))
                  (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 69))
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; HttpOnly (8 символов)
    (if (i32.eq (local.get $len) (i32.const 8))
      (then
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.or ;; H|h
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 72))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 104))
                  )
                  (i32.or ;; t|T
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 116))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 84))
                  )
                )
                (i32.and
                  (i32.or ;; t|T
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 116))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 84))
                  )
                  (i32.or ;; p|P
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 112))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 80))
                  )
                )
              )
              (i32.and
                (i32.and
                  (i32.or ;; O|o
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 79))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 111))
                  )
                  (i32.or ;; n|N
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 110))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 78))
                  )
                )
                (i32.and
                  (i32.or ;; l|L
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 108))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 76))
                  )
                  (i32.or ;; y|Y
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 7)))) (i32.const 121))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 7)))) (i32.const 89))
                  )
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; SameSite (8 символов)
    (if (i32.eq (local.get $len) (i32.const 8))
      (then
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.or ;; S|s
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 83))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $start))) (i32.const 115))
                  )
                  (i32.or ;; a|A
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 97))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 1)))) (i32.const 65))
                  )
                )
                (i32.and
                  (i32.or ;; m|M
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 109))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 2)))) (i32.const 77))
                  )
                  (i32.or ;; e|E
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 101))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 3)))) (i32.const 69))
                  )
                )
              )
              (i32.and
                (i32.and
                  (i32.or ;; S|s
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 83))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 4)))) (i32.const 115))
                  )
                  (i32.or ;; i|I
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 105))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 5)))) (i32.const 73))
                  )
                )
                (i32.and
                  (i32.or ;; t|T
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 116))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 6)))) (i32.const 84))
                  )
                  (i32.or ;; e|E
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 7)))) (i32.const 101))
                    (i32.eq (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $start) (i32.const 7)))) (i32.const 69))
                  )
                )
              )
            )
          (then (return (i32.const 1)))
        )
      )
    )

    ;; Если ни один атрибут не подошел - возвращаем 0
    (return (i32.const 0))
  )

  (export "detectFormat" (func $detectFormat))
  (export "validateKnownAttribute" (func $validateKnownAttribute))
)
