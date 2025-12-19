import User from "./user";

export default function Navbar() {
  return (
    <>
      {/* 画面上部固定のナビバー */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 h-full grid grid-cols-3 items-center">
          
          {/* 左端：メニュー */}
          <div className="flex justify-start">
            <button className="p-2 text-gray-600 active:bg-gray-100 rounded-md transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* 中央：アプリ名 */}
          <div className="flex justify-center">
            <span className="text-lg font-bold text-gray-900 tracking-tight truncate">
              App Name
            </span>
          </div>

          {/* 右端：ユーザー情報 */}
          <div className="flex justify-end">
            <User
              buttonClassName="relative inline-flex items-center justify-center w-9 h-9 overflow-hidden bg-gray-100 border border-gray-200 active:opacity-80 transition-opacity"
              spanClassName="absolute bottom-0 right-0 block w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"
            />
          </div>

        </div>
      </nav>

      {/* コンテンツがナビバーに重ならないためのスペーサー */}
      <div className="h-16" />
    </>
  );
}
