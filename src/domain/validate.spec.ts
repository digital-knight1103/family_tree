import { describe, expect, it } from 'vitest'
import { emptyFamilyData } from '@/domain/schema'
import { parseFamilyJson, validateFamilyData } from '@/domain/validate'

describe('validateFamilyData', () => {
  it('zwraca dane po poprawnej walidacji', () => {
    const data = emptyFamilyData()
    expect(validateFamilyData(data)).toEqual({ ok: true, data })
  })

  it('skleja ścieżkę błędu schematu', () => {
    const data = {
      ...emptyFamilyData(),
      persons: [
        {
          id: 'p_1',
          givenNames: '',
          surname: '',
          sex: 'unknown',
          living: false,
          birth: { date: { year: 1921, month: 13 } },
        },
      ],
    }
    const result = validateFamilyData(data)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]!.path).toBe('persons[0].birth.date.month')
      expect(result.errors[0]!.message.length).toBeGreaterThan(0)
    }
  })
})

describe('parseFamilyJson', () => {
  it('odrzuca pusty plik', () => {
    const result = parseFamilyJson('  \n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]!.path).toBe('')
      expect(result.errors[0]!.message).toContain('pusty')
    }
  })

  it('odrzuca niepoprawny JSON', () => {
    const result = parseFamilyJson('{"version":1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]!.path).toBe('')
      expect(result.errors[0]!.message.length).toBeGreaterThan(0)
    }
  })

  it('akceptuje plik z BOM UTF-8', () => {
    const bom = String.fromCharCode(0xfeff)
    expect(parseFamilyJson(bom + JSON.stringify(emptyFamilyData())).ok).toBe(true)
  })

  it('akceptuje końce linii CRLF', () => {
    const text = JSON.stringify(emptyFamilyData(), null, 2).replace(/\n/g, '\r\n')
    expect(parseFamilyJson(text).ok).toBe(true)
  })

  it('zwraca naruszenie reguły relacji ze ścieżką', () => {
    const data = {
      ...emptyFamilyData(),
      persons: [{ id: 'p_1', givenNames: '', surname: '', sex: 'unknown', living: false }],
      parentChild: [{ parentId: 'p_1', childId: 'p_1', type: 'biological' }],
    }
    const result = parseFamilyJson(JSON.stringify(data))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((e) => e.path)).toEqual(['parentChild[0]'])
  })
})
