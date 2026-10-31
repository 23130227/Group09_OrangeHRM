/*describe('template spec', () => {
   //TC01: Kiểm tra mở trang  Entitlements
  it('passes', () => {
cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('input[name="username"]').type('Admin')
    cy.get('input[name="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    // Đợi đăng nhập thành công
    cy.url().should('include', '/dashboard')

    // Chuyển sang trang Leave Entitlements
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveEntitlements')

    // Kiểm tra đã chuyển trang thành công
    cy.url().should('include', '/leave/viewLeaveEntitlements')
  })
  it('thu hien search ',()=>{
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
   cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveEntitlements')
    cy.get('#app input[placeholder="Type for hints..."]').click();
    cy.get('#app input[placeholder="Type for hints..."]').type('L');
    cy.get('.oxd-autocomplete-option')
      .filter(':visible')
      .should(($options) => {
        expect($options).to.have.length.greaterThan(0);
        expect($options.first().text().trim()).not.to.match(/searching|no records found/i);
      })
      .first()
      .click();
    cy.get('#app div:nth-child(2) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();

    cy.get('#app div:nth-child(3) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();
    cy.get('#app button.oxd-button').click();
  })
  it('kiem tra add entitlements',()=>{
        cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
    cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveEntitlements')
    cy.get('#app input[placeholder="Type for hints..."]').click();
    cy.get('#app input[placeholder="Type for hints..."]').type('L');
    cy.get('.oxd-autocomplete-option')
      .filter(':visible')
      .should(($options) => {
        expect($options).to.have.length.greaterThan(0);
        expect($options.first().text().trim()).not.to.match(/searching|no records found/i);
      })
      .first()
      .click();
    cy.get('#app div:nth-child(2) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();

    cy.get('#app div:nth-child(3) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();
    cy.get('#app button.oxd-button').click();
    cy.get('#app div.orangehrm-header-container button.oxd-button').click();
  })
})*/
describe('Leave - View My Leave Entitlements', () => {
  const BASE = 'https://opensource-demo.orangehrmlive.com/web/index.php'

  // Đăng nhập + mở trang My Entitlements (dùng chung cho các test case)
  const loginAndOpenMyEntitlements = () => {
    cy.visit(`${BASE}/auth/login`)
    cy.get('input[name="username"]').type('Admin')
    cy.get('input[name="password"]').type('admin123')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')

    cy.visit(`${BASE}/leave/viewMyLeaveEntitlements`)
    cy.url().should('include', '/leave/viewMyLeaveEntitlements')
    cy.get('.oxd-loading-spinner').should('not.exist')
  }

  // Chọn một option trong dropdown theo label của field
  const selectOption = (label, index = 1) => {
    cy.contains('label', label)
      .parents('.oxd-input-group')
      .find('.oxd-select-text')
      .click()
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', index)
      .eq(index)
      .click()
  }

  const clickSearch = () => {
    cy.get('button[type="submit"]').contains('Search').click()
    cy.get('.oxd-loading-spinner').should('not.exist')
  }

  beforeEach(() => {
    loginAndOpenMyEntitlements()
  })

  // TC01: Kiểm tra mở trang My Entitlements
  it('TC01 - Mở trang My Entitlements', () => {
    cy.url().should('include', '/leave/viewMyLeaveEntitlements')
    cy.contains('My Leave Entitlements').should('be.visible')
  })

  // TC02: Kiểm tra các thành phần của form tìm kiếm
  it('TC02 - Hiển thị đầy đủ form tìm kiếm', () => {
    cy.contains('label', 'Leave Type').should('be.visible')
    cy.contains('label', 'Leave Period').should('be.visible')
    cy.get('button[type="submit"]').contains('Search').should('be.visible')
  })

  // TC03: Search mặc định (không đổi bộ lọc)
  it('TC03 - Search với bộ lọc mặc định', () => {
    clickSearch()
    cy.get('body').then(($body) => {
      if ($body.find('.oxd-table-body .oxd-table-card').length > 0) {
        cy.get('.oxd-table-body .oxd-table-card').should('have.length.greaterThan', 0)
        cy.contains(/Total/i).should('be.visible')
      } else {
        cy.contains('No Records Found').should('be.visible')
      }
    })
  })

  // TC04: Kiểm tra tiêu đề các cột của bảng kết quả
  it('TC04 - Bảng kết quả có đủ các cột', () => {
    clickSearch()
    cy.get('body').then(($body) => {
      if ($body.find('.oxd-table-header').length > 0) {
        ;['Leave Type', 'Entitlement Type', 'Valid From', 'Valid To', 'Days'].forEach((col) => {
          cy.get('.oxd-table-header').should('contain.text', col)
        })
      } else {
        cy.log('Không có dữ liệu entitlement nên bảng không hiển thị header')
      }
    })
  })

  // TC05: Lọc theo Leave Type
  it('TC05 - Search theo Leave Type', () => {
    selectOption('Leave Type', 1)
    clickSearch()
    cy.get('body').then(($body) => {
      if ($body.find('.oxd-table-body .oxd-table-card').length > 0) {
        cy.get('.oxd-table-body .oxd-table-card').should('have.length.greaterThan', 0)
      } else {
        cy.contains('No Records Found').should('be.visible')
      }
    })
  })

  // TC06: Lọc theo Leave Period
  it('TC06 - Search theo Leave Period', () => {
    cy.contains('label', 'Leave Period')
      .parents('.oxd-input-group')
      .find('.oxd-select-text')
      .click()
    cy.get('.oxd-select-option:visible').should('have.length.greaterThan', 0)
    cy.get('.oxd-select-option:visible').last().click()
    clickSearch()
    cy.url().should('include', '/leave/viewMyLeaveEntitlements')
  })

  // TC07: Lọc kết hợp Leave Type + Leave Period
  it('TC07 - Search kết hợp Leave Type và Leave Period', () => {
    selectOption('Leave Type', 1)
    cy.contains('label', 'Leave Period')
      .parents('.oxd-input-group')
      .find('.oxd-select-text')
      .click()
    cy.get('.oxd-select-option:visible').should('have.length.greaterThan', 0).first().click()
    clickSearch()
    cy.get('body').then(($body) => {
      if ($body.find('.oxd-table-body .oxd-table-card').length > 0) {
        cy.get('.oxd-table-body .oxd-table-card').should('have.length.greaterThan', 0)
      } else {
        cy.contains('No Records Found').should('be.visible')
      }
    })
  })
})