/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 카드/콘텐츠 안쪽 — 어플처럼 흰색 카드가 어두운 배경 위에 떠 있는 형태라 그대로 유지
        base: {
          950: '#FFFFFF',
          900: '#F4F6F7',
          800: '#E7EBED',
          700: '#D8DEE1',
          600: '#AEB6BC',
          500: '#7C8790',
          400: '#576068',
          300: '#3A4148',
          200: '#232930',
          100: '#12161B'
        },
        // 페이지 배경·사이드바 등 "바탕" — 어플과 동일한 다크 네이비
        page: {
          bg: '#1D232A',
          soft: '#262E37',
          border: '#343C45',
          text: '#F5F1EA',
          sub: '#9BA3AB'
        },
        // 브랜드 포인트 — 어플의 실제 포인트 색(골드·앰버)
        mist: {
          400: '#B9720A',
          500: '#B9720A',
          600: '#8F5708'
        },
        teal: {
          400: '#0E7C86',
          500: '#0B6A73'
        },
        violet: {
          400: '#6D4FC2',
          500: '#5B3FAE'
        },
        amber: {
          400: '#C97F0A',
          500: '#B06F08'
        }
      },
      // 휴대폰에서 작은 글씨가 읽기 어려워 xs(기본 12px)를 13px로 키움
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }]
      },
      fontFamily: {
        display: ['"Pretendard Variable"', 'Pretendard', 'sans-serif'],
        body: ['"Pretendard Variable"', 'Pretendard', 'sans-serif']
      }
    }
  },
  plugins: []
}
